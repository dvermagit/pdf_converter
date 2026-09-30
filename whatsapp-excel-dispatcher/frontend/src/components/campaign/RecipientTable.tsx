import { Box, Flex, Text, Icon } from '@chakra-ui/react';
import { FiRefreshCw, FiUser, FiPhone, FiClock } from 'react-icons/fi';
import { StatusBadge } from '../dashboard/StatusBadge';
import type { Recipient } from '../../types';

interface RecipientTableProps {
  recipients: Recipient[];
  onRetry?: (recipientId: string) => void;
  isRetrying?: boolean;
}

export function RecipientTable({ recipients, onRetry, isRetrying }: RecipientTableProps) {
  if (recipients.length === 0) {
    return (
      <Flex
        direction="column"
        align="center"
        py={10}
        bg="#111827"
        border="1px solid"
        borderColor="#1f2937"
        borderRadius="16px"
      >
        <Icon as={FiUser} color="#374151" boxSize={10} mb={3} />
        <Text color="#6b7280" fontSize="sm">
          No recipients found
        </Text>
      </Flex>
    );
  }

  return (
    <Box
      overflowX="auto"
      borderRadius="16px"
      border="1px solid"
      borderColor="#1f2937"
      bg="#111827"
    >
      <Box as="table" w="full" fontSize="sm">
        <Box as="thead">
          <Box as="tr" bg="#1a2332">
            {['Recipient', 'Phone', 'Scheduled', 'Status', 'Sent At', 'Actions'].map(
              (header) => (
                <Box
                  as="th"
                  key={header}
                  px={4}
                  py={3}
                  textAlign="left"
                  color="#6b7280"
                  fontWeight="600"
                  fontSize="xs"
                  textTransform="uppercase"
                  letterSpacing="0.05em"
                  whiteSpace="nowrap"
                >
                  {header}
                </Box>
              )
            )}
          </Box>
        </Box>
        <Box as="tbody">
          {recipients.map((recipient) => {
            const scheduledAt = new Date(recipient.scheduledAt).toLocaleString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            });
            const sentAt = recipient.sentAt
              ? new Date(recipient.sentAt).toLocaleString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—';

            return (
              <Box
                as="tr"
                key={recipient._id}
                borderTop="1px solid"
                borderColor="#1f2937"
                transition="all 0.15s"
                _hover={{ bg: 'rgba(255,255,255,0.02)' }}
              >
                <Box as="td" px={4} py={3}>
                  <Flex align="center" gap={2}>
                    <Flex
                      align="center"
                      justify="center"
                      w="32px"
                      h="32px"
                      borderRadius="8px"
                      bg="rgba(168,85,247,0.1)"
                      flexShrink={0}
                    >
                      <Text fontSize="xs" fontWeight="700" color="#a855f7">
                        {recipient.recipientName.charAt(0).toUpperCase()}
                      </Text>
                    </Flex>
                    <Text color="white" fontWeight="500" whiteSpace="nowrap">
                      {recipient.recipientName}
                    </Text>
                  </Flex>
                </Box>
                <Box as="td" px={4} py={3}>
                  <Flex align="center" gap={1.5}>
                    <Icon as={FiPhone} color="#6b7280" boxSize={3} />
                    <Text color="#9ca3af" fontSize="xs">
                      {recipient.phoneNumber}
                    </Text>
                  </Flex>
                </Box>
                <Box as="td" px={4} py={3}>
                  <Flex align="center" gap={1.5}>
                    <Icon as={FiClock} color="#6b7280" boxSize={3} />
                    <Text color="#9ca3af" fontSize="xs" whiteSpace="nowrap">
                      {scheduledAt}
                    </Text>
                  </Flex>
                </Box>
                <Box as="td" px={4} py={3}>
                  <StatusBadge status={recipient.status} />
                </Box>
                <Box as="td" px={4} py={3}>
                  <Text color="#6b7280" fontSize="xs" whiteSpace="nowrap">
                    {sentAt}
                  </Text>
                </Box>
                <Box as="td" px={4} py={3}>
                  {recipient.status === 'failed' && onRetry && (
                    <Box
                      as="button"
                      display="flex"
                      alignItems="center"
                      gap={1.5}
                      px={3}
                      py={1.5}
                      borderRadius="8px"
                      fontSize="xs"
                      fontWeight="600"
                      color="#f59e0b"
                      bg="rgba(245,158,11,0.1)"
                      border="1px solid rgba(245,158,11,0.2)"
                      transition="all 0.2s"
                      cursor={isRetrying ? 'wait' : 'pointer'}
                      _hover={{ bg: 'rgba(245,158,11,0.15)' }}
                      onClick={() => onRetry(recipient._id)}
                    >
                      <Icon as={FiRefreshCw} boxSize={3} />
                      Retry
                    </Box>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
