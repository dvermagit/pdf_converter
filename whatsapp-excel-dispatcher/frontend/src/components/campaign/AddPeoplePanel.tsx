import { useState } from 'react';
import { Box, Flex, Text, Icon } from '@chakra-ui/react';
import { FiPlus, FiTrash2, FiUserPlus } from 'react-icons/fi';
import { useAddRecipients } from '../../hooks/useTemplates';
import { TextField } from '../ui/fields';
import type { Campaign, ManualRecipientInput, ValidationError } from '../../types';

const emptyRow = (): ManualRecipientInput => ({ name: '', phone: '' });

interface AddPeoplePanelProps {
  campaign: Campaign;
}

/**
 * Lets people be added to a manually-created campaign after the fact. A live
 * campaign schedules them right away; a draft keeps them pending until start.
 */
export function AddPeoplePanel({ campaign }: AddPeoplePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [rows, setRows] = useState<ManualRecipientInput[]>([emptyRow()]);
  const [scheduledAt, setScheduledAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<ValidationError[]>([]);
  const [success, setSuccess] = useState<string | null>(null);

  const addMutation = useAddRecipients();

  const isLive = ['scheduled', 'in_progress'].includes(campaign.status);

  const updateRow = (index: number, key: keyof ManualRecipientInput, value: string) =>
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));

  const handleSubmit = async () => {
    setError(null);
    setRowErrors([]);
    setSuccess(null);

    const filled = rows.filter((r) => r.name.trim() || r.phone.trim());
    if (filled.length === 0) {
      setError('Enter at least one name and number');
      return;
    }

    try {
      const result = await addMutation.mutateAsync({
        campaignId: campaign._id,
        recipients: filled,
        scheduledAt: scheduledAt || undefined,
        // A live campaign needs a time; fall back to sending shortly from now.
        sendNow: !scheduledAt,
      });
      setRows([emptyRow()]);
      setScheduledAt('');
      setSuccess(
        result.scheduled
          ? `${result.addedCount} person(s) added and scheduled`
          : `${result.addedCount} person(s) added — they will go out when you start the campaign`
      );
    } catch (err) {
      const response = (
        err as { response?: { data?: { error?: string; errors?: ValidationError[] } } }
      )?.response;
      setError(response?.data?.error || 'Failed to add recipients');
      setRowErrors(response?.data?.errors ?? []);
    }
  };

  return (
    <Box
      bg="#111827"
      border="1px solid"
      borderColor="#1f2937"
      borderRadius="16px"
      p={5}
      mb={6}
    >
      <Flex
        justify="space-between"
        align="center"
        cursor="pointer"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <Flex align="center" gap={2}>
          <Icon as={FiUserPlus} color="#25D366" boxSize={4} />
          <Text fontSize="sm" fontWeight="700" color="white">
            Assign more people to this campaign
          </Text>
        </Flex>
        <Text fontSize="xs" color="#6b7280" fontWeight="600">
          {isOpen ? 'Hide' : 'Open'}
        </Text>
      </Flex>

      {isOpen && (
        <Box mt={4}>
          <Text fontSize="xs" color="#6b7280" mb={4}>
            They receive the same message as the rest of the campaign.
            {campaign.recurrence
              ? ` They join the daily schedule (${campaign.recurrence.time}) from today through ${new Date(
                  campaign.recurrence.endDate
                ).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })} — past days are not back-filled.`
              : isLive
              ? ' The campaign is already running, so new people are scheduled immediately.'
              : ' They stay pending until you start the campaign.'}
          </Text>

          <Flex direction="column" gap={2} mb={3}>
            {rows.map((row, index) => {
              const errors = rowErrors.filter((e) => e.row === index + 1);
              return (
                <Box key={index}>
                  <Flex gap={2} direction={{ base: 'column', md: 'row' }}>
                    <Box flex="1.4">
                      <TextField
                        borderColor={errors.length ? '#f43f5e' : '#374151'}
                        placeholder="Full name"
                        value={row.name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateRow(index, 'name', e.target.value)
                        }
                      />
                    </Box>
                    <Box flex="1.2">
                      <TextField
                        borderColor={errors.length ? '#f43f5e' : '#374151'}
                        placeholder="9876543210"
                        value={row.phone}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateRow(index, 'phone', e.target.value)
                        }
                      />
                    </Box>
                    {!campaign.recurrence && (
                      <Box flex="1.3">
                        <TextField
                          type="datetime-local"
                          css={{ colorScheme: 'dark' }}
                          value={row.scheduledAt || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            updateRow(index, 'scheduledAt', e.target.value)
                          }
                        />
                      </Box>
                    )}
                    <Flex
                      as="button"
                      align="center"
                      justify="center"
                      w={{ base: 'full', md: '32px' }}
                      h="38px"
                      borderRadius="8px"
                      border="1px solid #374151"
                      color="#6b7280"
                      flexShrink={0}
                      _hover={{ borderColor: '#f43f5e', color: '#f43f5e' }}
                      onClick={() =>
                        setRows((prev) =>
                          prev.length === 1 ? [emptyRow()] : prev.filter((_, i) => i !== index)
                        )
                      }
                    >
                      <Icon as={FiTrash2} boxSize={3.5} />
                    </Flex>
                  </Flex>
                  {errors.map((e, i) => (
                    <Text key={i} fontSize="xs" color="#f43f5e" mt={1} ml={1}>
                      {e.reason}
                    </Text>
                  ))}
                </Box>
              );
            })}
          </Flex>

          <Flex gap={3} align="flex-end" wrap="wrap" mb={3}>
            <Flex
              as="button"
              align="center"
              gap={2}
              px={4}
              py={2.5}
              borderRadius="10px"
              border="1px dashed #374151"
              color="#9ca3af"
              fontSize="sm"
              fontWeight="600"
              _hover={{ borderColor: '#25D366', color: '#25D366' }}
              onClick={() => setRows((prev) => [...prev, emptyRow()])}
            >
              <Icon as={FiPlus} boxSize={4} />
              Add row
            </Flex>

            {/* A recurring campaign already dictates the send times. */}
            {!campaign.recurrence && (
              <Box flex="1" minW="200px">
                <Text fontSize="xs" fontWeight="600" color="#9ca3af" mb={1.5}>
                  Send time for this batch ({campaign.timezone})
                </Text>
                <TextField
                  type="datetime-local"
                  css={{ colorScheme: 'dark' }}
                  value={scheduledAt}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setScheduledAt(e.target.value)
                  }
                />
              </Box>
            )}
          </Flex>

          {error && (
            <Text fontSize="sm" color="#f43f5e" fontWeight="600" mb={3}>
              {error}
            </Text>
          )}
          {success && (
            <Text fontSize="sm" color="#25D366" fontWeight="600" mb={3}>
              {success}
            </Text>
          )}

          <Box
            as="button"
            px={5}
            py={2.5}
            borderRadius="10px"
            bg="linear-gradient(135deg, #25D366, #128C7E)"
            color="white"
            fontSize="sm"
            fontWeight="700"
            opacity={addMutation.isPending ? 0.7 : 1}
            onClick={() => !addMutation.isPending && handleSubmit()}
          >
            {addMutation.isPending ? 'Adding…' : 'Add people'}
          </Box>
        </Box>
      )}
    </Box>
  );
}
