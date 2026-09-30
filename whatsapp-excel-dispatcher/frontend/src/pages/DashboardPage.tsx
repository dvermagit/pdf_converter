import { Box, Flex, Text, Spinner } from '@chakra-ui/react';
import { useDashboardStats } from '../hooks/usePolling';
import { StatsCards } from '../components/dashboard/StatsCards';
import { DeliveryTimeline } from '../components/dashboard/DeliveryTimeline';
import { CampaignCard } from '../components/campaign/CampaignCard';

export function DashboardPage() {
  const { data, isLoading, error } = useDashboardStats();

  if (isLoading && !data) {
    return (
      <Flex justify="center" align="center" minH="60vh">
        <Spinner size="lg" color="#25D366" />
      </Flex>
    );
  }

  if (error) {
    return (
      <Box p={6} bg="rgba(244,63,94,0.1)" borderRadius="16px" border="1px solid rgba(244,63,94,0.2)">
        <Text color="#f43f5e" fontWeight="600">
          Failed to load dashboard data
        </Text>
        <Text color="#6b7280" fontSize="sm" mt={1}>
          {error instanceof Error ? error.message : 'Unknown error'}
        </Text>
      </Box>
    );
  }

  if (!data) return null;

  return (
    <Box>
      {/* Header */}
      <Box mb={8}>
        <Text fontSize="2xl" fontWeight="800" color="white" mb={1}>
          Dashboard
        </Text>
        <Text fontSize="sm" color="#6b7280">
          Overview of your WhatsApp campaigns and deliveries
        </Text>
      </Box>

      {/* Stats Cards */}
      <Box mb={8}>
        <StatsCards stats={data.stats} />
      </Box>

      {/* Two Column Layout */}
      <Flex gap={6} direction={{ base: 'column', lg: 'row' }}>
        {/* Recent Campaigns */}
        <Box flex="1.5">
          <Text fontSize="md" fontWeight="700" color="white" mb={4}>
            Recent Campaigns
          </Text>
          {data.recentCampaigns.length === 0 ? (
            <Box
              bg="#111827"
              border="1px solid"
              borderColor="#1f2937"
              borderRadius="16px"
              p={8}
              textAlign="center"
            >
              <Text color="#6b7280" fontSize="sm">
                No campaigns yet. Create your first one!
              </Text>
            </Box>
          ) : (
            <Flex direction="column" gap={3}>
              {data.recentCampaigns.map((campaign) => (
                <CampaignCard key={campaign._id} campaign={campaign} />
              ))}
            </Flex>
          )}
        </Box>

        {/* Upcoming Deliveries */}
        <Box flex="1">
          <DeliveryTimeline deliveries={data.upcomingDeliveries} />
        </Box>
      </Flex>
    </Box>
  );
}
