import { useState } from 'react';
import { Box, Flex, Text, Spinner } from '@chakra-ui/react';
import { useCampaigns } from '../hooks/useCampaigns';
import { CampaignCard } from '../components/campaign/CampaignCard';

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'in_progress' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
];

export function CampaignsListPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useCampaigns(page, statusFilter || undefined);

  return (
    <Box>
      {/* Header */}
      <Flex justify="space-between" align="center" mb={6} wrap="wrap" gap={4}>
        <Box>
          <Text fontSize="2xl" fontWeight="800" color="white" mb={1}>
            Campaigns
          </Text>
          <Text fontSize="sm" color="#6b7280">
            Manage your WhatsApp delivery campaigns
          </Text>
        </Box>

        {/* Status Filters */}
        <Flex gap={2} flexWrap="wrap">
          {STATUS_FILTERS.map((filter) => (
            <Box
              key={filter.value}
              as="button"
              px={4}
              py={2}
              borderRadius="10px"
              fontSize="sm"
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

      {isLoading && !data ? (
        <Flex justify="center" py={10}>
          <Spinner size="lg" color="#25D366" />
        </Flex>
      ) : data?.campaigns.length === 0 ? (
        <Flex
          direction="column"
          align="center"
          py={16}
          bg="#111827"
          border="1px solid"
          borderColor="#1f2937"
          borderRadius="20px"
        >
          <Text fontSize="4xl" mb={3}>
            📋
          </Text>
          <Text color="#6b7280" fontSize="md" fontWeight="500" mb={1}>
            No campaigns found
          </Text>
          <Text color="#4b5563" fontSize="sm">
            {statusFilter
              ? 'Try a different filter'
              : 'Create your first campaign to get started'}
          </Text>
        </Flex>
      ) : (
        <>
          <Box
            display="grid"
            gridTemplateColumns={{ base: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }}
            gap={4}
          >
            {data?.campaigns.map((campaign) => (
              <CampaignCard key={campaign._id} campaign={campaign} />
            ))}
          </Box>

          {/* Pagination */}
          {data && data.pagination.totalPages > 1 && (
            <Flex justify="center" gap={2} mt={6}>
              {Array.from({ length: data.pagination.totalPages }, (_, i) => i + 1).map(
                (p) => (
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
                )
              )}
            </Flex>
          )}
        </>
      )}
    </Box>
  );
}
