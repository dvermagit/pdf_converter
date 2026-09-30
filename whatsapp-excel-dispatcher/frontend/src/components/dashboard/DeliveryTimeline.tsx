import { Box, Flex, Text, Icon } from '@chakra-ui/react';
import { FiClock, FiUser } from 'react-icons/fi';
import type { Recipient } from '../../types';

interface DeliveryTimelineProps {
  deliveries: Recipient[];
}

export function DeliveryTimeline({ deliveries }: DeliveryTimelineProps) {
  if (deliveries.length === 0) {
    return (
      <Box
        bg="#111827"
        border="1px solid"
        borderColor="#1f2937"
        borderRadius="16px"
        p={6}
      >
        <Text fontSize="md" fontWeight="700" color="white" mb={4}>
          Upcoming Deliveries
        </Text>
        <Flex direction="column" align="center" py={8}>
          <Icon as={FiClock} color="#374151" boxSize={10} mb={3} />
          <Text color="#6b7280" fontSize="sm">
            No upcoming deliveries in the next 24 hours
          </Text>
        </Flex>
      </Box>
    );
  }

  return (
    <Box
      bg="#111827"
      border="1px solid"
      borderColor="#1f2937"
      borderRadius="16px"
      p={6}
    >
      <Text fontSize="md" fontWeight="700" color="white" mb={4}>
        Upcoming Deliveries
      </Text>
      <Flex direction="column" gap={0} position="relative">
        {/* Timeline line */}
        <Box
          position="absolute"
          left="15px"
          top="12px"
          bottom="12px"
          w="2px"
          bg="linear-gradient(to bottom, #25D366, #128C7E, transparent)"
        />

        {deliveries.slice(0, 10).map((delivery, idx) => {
          const scheduled = new Date(delivery.scheduledAt);
          const timeStr = scheduled.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
          });
          const dateStr = scheduled.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
          });

          return (
            <Flex
              key={delivery._id}
              align="flex-start"
              gap={4}
              py={3}
              position="relative"
            >
              {/* Timeline dot */}
              <Box
                w="10px"
                h="10px"
                borderRadius="full"
                bg="#25D366"
                mt="6px"
                flexShrink={0}
                zIndex={1}
                boxShadow="0 0 8px rgba(37,211,102,0.4)"
                border="2px solid"
                borderColor="#111827"
                position="relative"
                left="11px"
              />

              <Box flex="1" ml={2}>
                <Flex justify="space-between" align="center" mb={1}>
                  <Flex align="center" gap={2}>
                    <Icon as={FiUser} color="#9ca3af" boxSize={3.5} />
                    <Text fontSize="sm" fontWeight="600" color="white">
                      {delivery.recipientName}
                    </Text>
                  </Flex>
                  <Text fontSize="xs" color="#6b7280">
                    {dateStr} · {timeStr}
                  </Text>
                </Flex>
                <Text fontSize="xs" color="#6b7280" truncate>
                  {delivery.phoneNumber}
                </Text>
              </Box>
            </Flex>
          );
        })}
      </Flex>
    </Box>
  );
}
