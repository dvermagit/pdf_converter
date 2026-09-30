import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Flex, Text, Icon, Spinner } from '@chakra-ui/react';
import { FiArrowLeft, FiTrash2, FiPlay, FiRepeat } from 'react-icons/fi';
import { useCampaign, useRecipients, useStartCampaign, useCancelCampaign, useRetryRecipient } from '../hooks/useCampaigns';
import { StatusBadge } from '../components/dashboard/StatusBadge';
import { RecipientTable } from '../components/campaign/RecipientTable';
import { AddPeoplePanel } from '../components/campaign/AddPeoplePanel';

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Queued', value: 'queued' },
  { label: 'Sent', value: 'sent' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Read', value: 'read' },
  { label: 'Failed', value: 'failed' },
];

export function CampaignPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data: campaignData, isLoading } = useCampaign(id || '');
  const { data: recipientData } = useRecipients(id || '', page, statusFilter || undefined);
  const startMutation = useStartCampaign();
  const cancelMutation = useCancelCampaign();
  const retryMutation = useRetryRecipient();

  if (isLoading || !campaignData) {
    return (
      <Flex justify="center" align="center" minH="60vh">
        <Spinner size="lg" color="#25D366" />
      </Flex>
    );
  }

  const campaign = campaignData.campaign;
  const total = campaign.totalRecipients || 1;
  const progress = Math.round(
    ((campaign.sent + campaign.delivered + campaign.failed) / total) * 100
  );

  return (
    <Box>
      {/* Back button */}
      <Flex
        align="center"
        gap={2}
        mb={6}
        color="#6b7280"
        cursor="pointer"
        _hover={{ color: 'white' }}
        onClick={() => navigate('/campaigns')}
        w="fit-content"
      >
        <Icon as={FiArrowLeft} boxSize={4} />
        <Text fontSize="sm" fontWeight="500">
          Back to Campaigns
        </Text>
      </Flex>

      {/* Campaign Header */}
      <Box
        bg="#111827"
        border="1px solid"
        borderColor="#1f2937"
        borderRadius="20px"
        p={6}
        mb={6}
      >
        <Flex justify="space-between" align="flex-start" mb={4} wrap="wrap" gap={4}>
          <Box>
            <Flex align="center" gap={3} mb={2}>
              <Text fontSize="xl" fontWeight="800" color="white">
                {campaign.name}
              </Text>
              <StatusBadge status={campaign.status} size="md" />
            </Flex>
            <Text fontSize="sm" color="#6b7280">
              {campaign.source === 'manual'
                ? 'Added manually'
                : campaign.originalFileName}{' '}
              · {campaign.timezone}
            </Text>
            {campaign.recurrence && (
              <Flex align="center" gap={1.5} mt={2}>
                <Icon as={FiRepeat} color="#25D366" boxSize={3.5} />
                <Text fontSize="xs" color="#25D366" fontWeight="600">
                  Daily at {campaign.recurrence.time} ·{' '}
                  {new Date(campaign.recurrence.startDate).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                  })}{' '}
                  →{' '}
                  {new Date(campaign.recurrence.endDate).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
              </Flex>
            )}
          </Box>

          {/* Actions */}
          <Flex gap={2}>
            {campaign.status === 'validated' && (
              <Box
                as="button"
                display="flex"
                alignItems="center"
                gap={2}
                px={4}
                py={2}
                borderRadius="10px"
                bg="linear-gradient(135deg, #25D366, #128C7E)"
                color="white"
                fontSize="sm"
                fontWeight="600"
                transition="all 0.3s"
                _hover={{ transform: 'translateY(-1px)', boxShadow: '0 4px 20px rgba(37,211,102,0.3)' }}
                onClick={() => startMutation.mutate(campaign._id)}
              >
                <Icon as={FiPlay} boxSize={4} />
                Start Campaign
              </Box>
            )}
            {['scheduled', 'in_progress'].includes(campaign.status) && (
              <Box
                as="button"
                display="flex"
                alignItems="center"
                gap={2}
                px={4}
                py={2}
                borderRadius="10px"
                border="1px solid rgba(244,63,94,0.3)"
                bg="rgba(244,63,94,0.1)"
                color="#f43f5e"
                fontSize="sm"
                fontWeight="600"
                transition="all 0.2s"
                _hover={{ bg: 'rgba(244,63,94,0.15)' }}
                onClick={() => cancelMutation.mutate(campaign._id)}
              >
                <Icon as={FiTrash2} boxSize={4} />
                Cancel
              </Box>
            )}
          </Flex>
        </Flex>

        {/* Progress bar */}
        <Box mb={4}>
          <Flex justify="space-between" mb={2}>
            <Text fontSize="xs" color="#6b7280" fontWeight="500">
              Delivery Progress
            </Text>
            <Text fontSize="xs" color="#9ca3af" fontWeight="600">
              {progress}%
            </Text>
          </Flex>
          <Box h="6px" bg="#1f2937" borderRadius="full" overflow="hidden">
            <Box
              h="full"
              borderRadius="full"
              bg="linear-gradient(90deg, #25D366, #128C7E)"
              w={`${progress}%`}
              transition="width 0.5s ease"
            />
          </Box>
        </Box>

        {/* Stats */}
        <Flex gap={6} flexWrap="wrap">
          {[
            { label: 'Total', value: campaign.totalRecipients, color: 'white' },
            { label: 'Sent', value: campaign.sent, color: '#14b8a6' },
            { label: 'Delivered', value: campaign.delivered, color: '#25D366' },
            { label: 'Failed', value: campaign.failed, color: '#f43f5e' },
            { label: 'Pending', value: campaign.pending, color: '#6b7280' },
          ].map((stat) => (
            <Box key={stat.label}>
              <Text fontSize="xl" fontWeight="800" color={stat.color}>
                {stat.value}
              </Text>
              <Text fontSize="xs" color="#6b7280" textTransform="uppercase" letterSpacing="0.05em">
                {stat.label}
              </Text>
            </Box>
          ))}
        </Flex>
      </Box>

      {/* Assign more people — only for campaigns built with the form */}
      {campaign.source === 'manual' &&
        ['validated', 'scheduled', 'in_progress'].includes(campaign.status) && (
          <AddPeoplePanel campaign={campaign} />
        )}

      {/* Recipients Section */}
      <Box>
        <Flex justify="space-between" align="center" mb={4} wrap="wrap" gap={3}>
          <Text fontSize="md" fontWeight="700" color="white">
            Recipients
          </Text>

          {/* Status filter chips */}
          <Flex gap={2} flexWrap="wrap">
            {STATUS_FILTERS.map((filter) => (
              <Box
                key={filter.value}
                as="button"
                px={3}
                py={1.5}
                borderRadius="full"
                fontSize="xs"
                fontWeight="600"
                border="1px solid"
                borderColor={statusFilter === filter.value ? '#25D366' : '#374151'}
                bg={statusFilter === filter.value ? 'rgba(37,211,102,0.1)' : 'transparent'}
                color={statusFilter === filter.value ? '#25D366' : '#9ca3af'}
                transition="all 0.2s"
                _hover={{ borderColor: '#6b7280' }}
                onClick={() => {
                  setStatusFilter(filter.value);
                  setPage(1);
                }}
              >
                {filter.label}
              </Box>
            ))}
          </Flex>
        </Flex>

        <RecipientTable
          recipients={recipientData?.recipients || []}
          onRetry={(recipientId) =>
            retryMutation.mutate({ campaignId: campaign._id, recipientId })
          }
          isRetrying={retryMutation.isPending}
        />

        {/* Pagination */}
        {recipientData && recipientData.pagination.totalPages > 1 && (
          <Flex justify="center" gap={2} mt={4}>
            {Array.from({ length: recipientData.pagination.totalPages }, (_, i) => i + 1)
              .slice(Math.max(0, page - 3), page + 2)
              .map((p) => (
                <Box
                  key={p}
                  as="button"
                  w="36px"
                  h="36px"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  borderRadius="8px"
                  fontSize="sm"
                  fontWeight="600"
                  bg={p === page ? 'rgba(37,211,102,0.15)' : '#1f2937'}
                  color={p === page ? '#25D366' : '#9ca3af'}
                  border="1px solid"
                  borderColor={p === page ? '#25D366' : '#374151'}
                  transition="all 0.2s"
                  _hover={{ borderColor: '#6b7280' }}
                  onClick={() => setPage(p)}
                >
                  {p}
                </Box>
              ))}
          </Flex>
        )}
      </Box>
    </Box>
  );
}
