import { useEffect, useMemo, useState } from 'react';
import { Box, Flex, Text, Icon, Spinner } from '@chakra-ui/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FiPlus,
  FiTrash2,
  FiUsers,
  FiSend,
  FiUpload,
  FiClipboard,
  FiEye,
  FiRepeat,
} from 'react-icons/fi';
import { useTemplates, useCreateManualCampaign } from '../hooks/useTemplates';
import { previewManualCampaign } from '../services/api';
import { TextField, TextAreaField, SelectField } from '../components/ui/fields';
import { ImportContactsPanel } from '../components/campaign/ImportContactsPanel';
import type {
  ManualPreviewResponse,
  ManualRecipientInput,
  ValidationError,
} from '../types';

const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
  { value: 'America/New_York', label: 'America/New_York (EST)' },
  { value: 'Europe/London', label: 'Europe/London (GMT)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' },
  { value: 'UTC', label: 'UTC' },
];

type SendMode = 'once' | 'now' | 'daily';

const SEND_MODES: Array<{ label: string; value: SendMode }> = [
  { label: 'Schedule for later', value: 'once' },
  { label: 'Send now', value: 'now' },
  { label: 'Daily range', value: 'daily' },
];

const emptyRow = (): ManualRecipientInput => ({ name: '', phone: '' });

function errorMessage(err: unknown, fallback: string): string {
  const response = (err as { response?: { data?: { error?: string; errors?: ValidationError[] } } })
    ?.response;
  return response?.data?.error || fallback;
}

function errorList(err: unknown): ValidationError[] {
  const response = (err as { response?: { data?: { errors?: ValidationError[] } } })?.response;
  return response?.data?.errors ?? [];
}

/** Default schedule: tomorrow at 10:00, as a `datetime-local` value. */
function defaultScheduleValue(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function ManualCampaignPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: templateData, isLoading: templatesLoading } = useTemplates();
  const createMutation = useCreateManualCampaign();

  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState(searchParams.get('template') || '');
  const [message, setMessage] = useState('');
  const [messageTouched, setMessageTouched] = useState(false);
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [sendMode, setSendMode] = useState<SendMode>('once');
  const [scheduledAt, setScheduledAt] = useState(defaultScheduleValue);
  const [rangeStart, setRangeStart] = useState(() => defaultScheduleValue().slice(0, 10));
  const [rangeEnd, setRangeEnd] = useState(() => defaultScheduleValue().slice(0, 10));
  const [rangeTime, setRangeTime] = useState('10:00');
  const [recipients, setRecipients] = useState<ManualRecipientInput[]>([emptyRow(), emptyRow()]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [preview, setPreview] = useState<ManualPreviewResponse | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ValidationError[]>([]);

  const templates = useMemo(() => templateData?.templates ?? [], [templateData]);
  const selectedTemplate = templates.find((t) => t._id === templateId);

  // Selecting a template seeds the message, timezone and schedule — until the
  // user edits the message themselves, at which point their text wins.
  useEffect(() => {
    if (!selectedTemplate) return;

    if (!messageTouched) {
      setMessage(selectedTemplate.messageBody);
    }
    setTimezone(selectedTemplate.timezone);
    if (!name.trim()) {
      setName(selectedTemplate.name);
    }
    if (selectedTemplate.eventDate) {
      const day = selectedTemplate.eventDate.slice(0, 10);
      setScheduledAt(`${day}T${selectedTemplate.defaultSendTime || '10:00'}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplate?._id]);

  const updateRow = (index: number, key: keyof ManualRecipientInput, value: string) => {
    setRecipients((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [key]: value } : row))
    );
  };

  const addRow = () => setRecipients((prev) => [...prev, emptyRow()]);

  const removeRow = (index: number) =>
    setRecipients((prev) => (prev.length === 1 ? [emptyRow()] : prev.filter((_, i) => i !== index)));

  /** Parse "Name, phone" (or "Name<tab>phone") lines pasted from a list. */
  const applyBulkPaste = () => {
    const parsed = bulkText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/[,\t;]+/).map((p) => p.trim());
        if (parts.length === 1) {
          // A bare number with no name
          return { name: '', phone: parts[0] };
        }
        // Whichever part looks like a number is the phone
        const phoneIndex = parts.findIndex((p) => /\d{6,}/.test(p));
        const phone = phoneIndex >= 0 ? parts[phoneIndex] : parts[1];
        const nameParts = parts.filter((_, i) => i !== (phoneIndex >= 0 ? phoneIndex : 1));
        return { name: nameParts.join(' ').trim(), phone };
      });

    if (parsed.length === 0) return;

    appendPeople(parsed);
    setBulkText('');
    setBulkOpen(false);
  };

  /** Append imported/pasted people, dropping the blank starter rows. */
  const appendPeople = (people: Array<{ name: string; phone: string; dateOfBirth?: string }>) => {
    if (people.length === 0) return;
    setRecipients((prev) => {
      const existing = prev.filter((r) => r.name.trim() || r.phone.trim());
      return [...existing, ...people.map((p) => ({ ...p }))];
    });
  };

  const filledRecipients = recipients.filter((r) => r.name.trim() || r.phone.trim());

  // Inclusive day count for the range summary; 0 when the dates are invalid.
  const rangeDays = useMemo(() => {
    if (sendMode !== 'daily' || !rangeStart || !rangeEnd) return 0;
    const start = Date.parse(`${rangeStart}T00:00:00Z`);
    const end = Date.parse(`${rangeEnd}T00:00:00Z`);
    if (isNaN(start) || isNaN(end) || end < start) return 0;
    return Math.round((end - start) / 86_400_000) + 1;
  }, [sendMode, rangeStart, rangeEnd]);

  const buildPayload = () => ({
    templateId: templateId || undefined,
    message: message.trim() || undefined,
    eventName: selectedTemplate?.name,
    eventDate: selectedTemplate?.eventDate?.slice(0, 10),
    timezone,
    sendNow: sendMode === 'now',
    scheduledAt: sendMode === 'once' ? scheduledAt : undefined,
    repeat:
      sendMode === 'daily'
        ? { mode: 'daily' as const, startDate: rangeStart, endDate: rangeEnd, time: rangeTime }
        : undefined,
    recipients: filledRecipients,
  });

  const handlePreview = async () => {
    setIsPreviewing(true);
    setFormError(null);
    try {
      const result = await previewManualCampaign(buildPayload());
      setPreview(result);
      setFieldErrors(result.errors);
    } catch (err) {
      setFormError(errorMessage(err, 'Preview failed'));
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSubmit = async (startNow: boolean) => {
    setFormError(null);
    setFieldErrors([]);

    if (!name.trim()) {
      setFormError('Give the campaign a name');
      return;
    }
    if (filledRecipients.length === 0) {
      setFormError('Add at least one person');
      return;
    }
    if (!message.trim() && !templateId) {
      setFormError('Pick a template or write a message');
      return;
    }

    try {
      const { campaign } = await createMutation.mutateAsync({
        name: name.trim(),
        ...buildPayload(),
        startNow,
      });
      navigate(`/campaigns/${campaign._id}`);
    } catch (err) {
      setFormError(errorMessage(err, 'Failed to create campaign'));
      setFieldErrors(errorList(err));
    }
  };

  const rowErrors = (index: number) => fieldErrors.filter((e) => e.row === index + 1);

  return (
    <Box maxW="900px" mx="auto">
      {/* Header */}
      <Flex justify="space-between" align="flex-start" mb={8} wrap="wrap" gap={4}>
        <Box>
          <Text fontSize="2xl" fontWeight="800" color="white" mb={1}>
            New Campaign — Add People Manually
          </Text>
          <Text fontSize="sm" color="#6b7280">
            Pick a template, type your contacts and schedule the send. No Excel needed.
          </Text>
        </Box>
        <Flex
          as="button"
          align="center"
          gap={2}
          px={4}
          py={2.5}
          borderRadius="10px"
          border="1px solid #374151"
          color="#9ca3af"
          fontSize="sm"
          fontWeight="600"
          _hover={{ borderColor: '#6b7280', color: 'white' }}
          onClick={() => navigate('/upload')}
        >
          <Icon as={FiUpload} boxSize={4} />
          Upload Excel instead
        </Flex>
      </Flex>

      {/* 1 — Campaign basics */}
      <Box
        bg="#111827"
        border="1px solid"
        borderColor="#1f2937"
        borderRadius="20px"
        p={{ base: 5, md: 6 }}
        mb={5}
      >
        <Text fontSize="md" fontWeight="700" color="white" mb={4}>
          1. Campaign &amp; Template
        </Text>

        <Flex gap={4} direction={{ base: 'column', md: 'row' }} mb={4}>
          <Box flex="1">
            <Text fontSize="xs" fontWeight="600" color="#9ca3af" mb={1.5}>
              Campaign Name
            </Text>
            <TextField
              placeholder="Diwali wishes 2026"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            />
          </Box>
          <Box flex="1">
            <Text fontSize="xs" fontWeight="600" color="#9ca3af" mb={1.5}>
              Template
            </Text>
            <SelectField
              value={templateId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                setTemplateId(e.target.value);
                setMessageTouched(false);
              }}
              css={{ '& option': { background: '#111827', color: 'white' } }}
            >
              <option value="">— No template (write your own) —</option>
              {templates.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.emoji} {t.name}
                </option>
              ))}
            </SelectField>
            {templatesLoading && (
              <Text fontSize="xs" color="#4b5563" mt={1}>
                Loading templates…
              </Text>
            )}
            {!templatesLoading && templates.length === 0 && (
              <Text
                fontSize="xs"
                color="#25D366"
                mt={1.5}
                cursor="pointer"
                onClick={() => navigate('/templates')}
              >
                No templates yet — create one →
              </Text>
            )}
          </Box>
        </Flex>

        <Box>
          <Text fontSize="xs" fontWeight="600" color="#9ca3af" mb={1.5}>
            Message{' '}
            <Text as="span" color="#4b5563">
              — {'{{name}}'} is replaced with each person&apos;s name
            </Text>
          </Text>
          <TextAreaField
            rows={6}
            lineHeight="1.6"
            resize="vertical"
            placeholder="Hi {{name}}, wishing you a very Happy Diwali!"
            value={message}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
              setMessage(e.target.value);
              setMessageTouched(true);
            }}
          />
        </Box>
      </Box>

      {/* 2 — Schedule */}
      <Box
        bg="#111827"
        border="1px solid"
        borderColor="#1f2937"
        borderRadius="20px"
        p={{ base: 5, md: 6 }}
        mb={5}
      >
        <Text fontSize="md" fontWeight="700" color="white" mb={4}>
          2. When to send
        </Text>

        <Flex gap={2} mb={4} flexWrap="wrap">
          {SEND_MODES.map((option) => (
            <Box
              key={option.value}
              as="button"
              px={4}
              py={2}
              borderRadius="10px"
              fontSize="sm"
              fontWeight="600"
              border="1px solid"
              borderColor={sendMode === option.value ? '#25D366' : '#374151'}
              bg={sendMode === option.value ? 'rgba(37,211,102,0.1)' : 'transparent'}
              color={sendMode === option.value ? '#25D366' : '#9ca3af'}
              transition="all 0.2s"
              onClick={() => setSendMode(option.value)}
            >
              {option.label}
            </Box>
          ))}
        </Flex>

        <Flex gap={4} direction={{ base: 'column', md: 'row' }}>
          {sendMode === 'once' && (
            <Box flex="1">
              <Text fontSize="xs" fontWeight="600" color="#9ca3af" mb={1.5}>
                Date &amp; Time
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

          {sendMode === 'daily' && (
            <>
              <Box flex="1">
                <Text fontSize="xs" fontWeight="600" color="#9ca3af" mb={1.5}>
                  Start Date
                </Text>
                <TextField
                  type="date"
                  css={{ colorScheme: 'dark' }}
                  value={rangeStart}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setRangeStart(e.target.value)
                  }
                />
              </Box>
              <Box flex="1">
                <Text fontSize="xs" fontWeight="600" color="#9ca3af" mb={1.5}>
                  End Date
                </Text>
                <TextField
                  type="date"
                  css={{ colorScheme: 'dark' }}
                  value={rangeEnd}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setRangeEnd(e.target.value)
                  }
                />
              </Box>
              <Box flex="0.8">
                <Text fontSize="xs" fontWeight="600" color="#9ca3af" mb={1.5}>
                  Time Each Day
                </Text>
                <TextField
                  type="time"
                  css={{ colorScheme: 'dark' }}
                  value={rangeTime}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setRangeTime(e.target.value)
                  }
                />
              </Box>
            </>
          )}

          <Box flex="1">
            <Text fontSize="xs" fontWeight="600" color="#9ca3af" mb={1.5}>
              Timezone
            </Text>
            <SelectField
              value={timezone}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTimezone(e.target.value)}
              css={{ '& option': { background: '#111827', color: 'white' } }}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </SelectField>
          </Box>
        </Flex>

        {sendMode === 'daily' ? (
          <Flex
            align="center"
            gap={2}
            mt={4}
            p={3}
            bg={rangeDays > 0 ? 'rgba(37,211,102,0.06)' : 'rgba(244,63,94,0.06)'}
            border="1px solid"
            borderColor={rangeDays > 0 ? 'rgba(37,211,102,0.2)' : 'rgba(244,63,94,0.2)'}
            borderRadius="10px"
          >
            <Icon as={FiRepeat} color={rangeDays > 0 ? '#25D366' : '#f43f5e'} boxSize={4} />
            <Text fontSize="xs" color={rangeDays > 0 ? '#9ca3af' : '#f43f5e'}>
              {rangeDays > 0 ? (
                <>
                  <Text as="span" color="white" fontWeight="700">
                    {rangeDays} day{rangeDays === 1 ? '' : 's'}
                  </Text>{' '}
                  × {filledRecipients.length} {filledRecipients.length === 1 ? 'person' : 'people'} ={' '}
                  <Text as="span" color="white" fontWeight="700">
                    {rangeDays * filledRecipients.length} messages
                  </Text>{' '}
                  — one per person per day at {rangeTime}
                </>
              ) : (
                'End date must be on or after the start date'
              )}
            </Text>
          </Flex>
        ) : (
          <Text fontSize="xs" color="#4b5563" mt={3}>
            Individual people can override this time in the list below.
          </Text>
        )}
      </Box>

      {/* 3 — People */}
      <Box
        bg="#111827"
        border="1px solid"
        borderColor="#1f2937"
        borderRadius="20px"
        p={{ base: 5, md: 6 }}
        mb={5}
      >
        <Flex justify="space-between" align="center" mb={4} wrap="wrap" gap={3}>
          <Flex align="center" gap={2}>
            <Icon as={FiUsers} color="#25D366" boxSize={4} />
            <Text fontSize="md" fontWeight="700" color="white">
              3. People ({filledRecipients.length})
            </Text>
          </Flex>
          <Flex align="center" gap={2} flexWrap="wrap">
          <ImportContactsPanel onImported={appendPeople} />
          <Flex
            as="button"
            align="center"
            gap={2}
            px={3}
            py={2}
            borderRadius="10px"
            border="1px solid #374151"
            color="#9ca3af"
            fontSize="xs"
            fontWeight="600"
            _hover={{ borderColor: '#6b7280', color: 'white' }}
            onClick={() => setBulkOpen((prev) => !prev)}
          >
            <Icon as={FiClipboard} boxSize={3.5} />
            Paste a list
          </Flex>
          </Flex>
        </Flex>

        {bulkOpen && (
          <Box mb={4}>
            <TextAreaField
              rows={5}
              placeholder={'Priya Sharma, 9876543210\nRahul Verma, +919812345678'}
              value={bulkText}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setBulkText(e.target.value)
              }
            />
            <Flex gap={2} mt={2}>
              <Box
                as="button"
                px={4}
                py={2}
                borderRadius="10px"
                bg="#25D366"
                color="white"
                fontSize="xs"
                fontWeight="700"
                onClick={applyBulkPaste}
              >
                Add to list
              </Box>
              <Box
                as="button"
                px={4}
                py={2}
                borderRadius="10px"
                bg="#1f2937"
                color="#9ca3af"
                fontSize="xs"
                fontWeight="600"
                onClick={() => setBulkOpen(false)}
              >
                Cancel
              </Box>
            </Flex>
            <Text fontSize="xs" color="#4b5563" mt={2}>
              One person per line — name and number separated by a comma.
            </Text>
          </Box>
        )}

        {/* Column headers */}
        <Flex
          gap={2}
          px={1}
          mb={2}
          display={{ base: 'none', md: 'flex' }}
          fontSize="10px"
          fontWeight="700"
          color="#4b5563"
          textTransform="uppercase"
          letterSpacing="0.05em"
        >
          <Box flex="1.4">Name</Box>
          <Box flex="1.2">Phone Number</Box>
          <Box flex="1">Date of Birth</Box>
          {sendMode !== 'daily' && <Box flex="1.3">Send Time (optional)</Box>}
          <Box w="32px" />
        </Flex>

        <Flex direction="column" gap={2}>
          {recipients.map((row, index) => {
            const errors = rowErrors(index);
            return (
              <Box key={index}>
                <Flex gap={2} direction={{ base: 'column', md: 'row' }}>
                  <Box flex="1.4">
                    <TextField
                      borderColor={errors.length > 0 ? '#f43f5e' : '#374151'}
                      placeholder="Full name"
                      value={row.name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateRow(index, 'name', e.target.value)
                      }
                    />
                  </Box>
                  <Box flex="1.2">
                    <TextField
                      borderColor={errors.length > 0 ? '#f43f5e' : '#374151'}
                      placeholder="9876543210"
                      value={row.phone}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateRow(index, 'phone', e.target.value)
                      }
                    />
                  </Box>
                  <Box flex="1">
                    <TextField
                      type="date"
                      css={{ colorScheme: 'dark' }}
                      value={row.dateOfBirth || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateRow(index, 'dateOfBirth', e.target.value)
                      }
                    />
                  </Box>
                  {sendMode !== 'daily' && (
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
                    onClick={() => removeRow(index)}
                  >
                    <Icon as={FiTrash2} boxSize={3.5} />
                  </Flex>
                </Flex>
                {errors.map((error, i) => (
                  <Text key={i} fontSize="xs" color="#f43f5e" mt={1} ml={1}>
                    {error.reason}
                  </Text>
                ))}
              </Box>
            );
          })}
        </Flex>

        <Flex
          as="button"
          align="center"
          gap={2}
          mt={3}
          px={4}
          py={2.5}
          borderRadius="10px"
          border="1px dashed #374151"
          color="#9ca3af"
          fontSize="sm"
          fontWeight="600"
          w="fit-content"
          _hover={{ borderColor: '#25D366', color: '#25D366' }}
          onClick={addRow}
        >
          <Icon as={FiPlus} boxSize={4} />
          Add person
        </Flex>
      </Box>

      {/* Preview */}
      {preview && (
        <Box
          bg="#111827"
          border="1px solid"
          borderColor={preview.isValid ? 'rgba(37,211,102,0.3)' : 'rgba(244,63,94,0.3)'}
          borderRadius="20px"
          p={{ base: 5, md: 6 }}
          mb={5}
        >
          <Text fontSize="md" fontWeight="700" color="white" mb={1}>
            Preview — {preview.totalRecipients} message
            {preview.totalRecipients === 1 ? '' : 's'}
            {preview.messagesPerPerson > 1 && (
              <Text as="span" fontWeight="400" color="#6b7280">
                {' '}
                ({preview.peopleCount} {preview.peopleCount === 1 ? 'person' : 'people'} ×{' '}
                {preview.messagesPerPerson} days)
              </Text>
            )}
          </Text>
          <Text fontSize="xs" color="#6b7280" mb={4}>
            {preview.errors.length > 0
              ? `${preview.errors.length} issue(s) to fix before sending`
              : preview.messagesPerPerson > 1 && preview.firstSendAt && preview.lastSendAt
              ? `Daily from ${new Date(preview.firstSendAt).toLocaleString('en-IN', {
                  timeZone: timezone,
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })} through ${new Date(preview.lastSendAt).toLocaleString('en-IN', {
                  timeZone: timezone,
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })} — showing the first day below`
              : 'This is exactly what each person will receive'}
          </Text>

          <Flex direction="column" gap={3}>
            {preview.recipients.map((r, i) => (
              <Box key={i} bg="#0a0e17" border="1px solid #1f2937" borderRadius="12px" p={4}>
                <Flex justify="space-between" mb={2} wrap="wrap" gap={2}>
                  <Text fontSize="sm" fontWeight="700" color="white">
                    {r.recipientName}{' '}
                    <Text as="span" color="#6b7280" fontWeight="400">
                      {r.phoneNumber}
                    </Text>
                  </Text>
                  <Text fontSize="xs" color="#25D366" fontWeight="600">
                    {new Date(r.scheduledAt).toLocaleString('en-IN', { timeZone: timezone })}
                  </Text>
                </Flex>
                <Text fontSize="xs" color="#9ca3af" whiteSpace="pre-wrap" lineHeight="1.6">
                  {r.message}
                </Text>
              </Box>
            ))}
          </Flex>
        </Box>
      )}

      {formError && (
        <Box
          mb={5}
          p={4}
          bg="rgba(244,63,94,0.08)"
          border="1px solid rgba(244,63,94,0.2)"
          borderRadius="12px"
        >
          <Text color="#f43f5e" fontSize="sm" fontWeight="600">
            {formError}
          </Text>
        </Box>
      )}

      {/* Actions */}
      <Flex gap={3} mb={10} direction={{ base: 'column', md: 'row' }}>
        <Flex
          as="button"
          flex="1"
          align="center"
          justify="center"
          gap={2}
          py={3}
          borderRadius="12px"
          bg="#1f2937"
          color="#9ca3af"
          fontWeight="600"
          fontSize="sm"
          _hover={{ bg: '#374151', color: 'white' }}
          onClick={handlePreview}
        >
          {isPreviewing ? <Spinner size="sm" /> : <Icon as={FiEye} boxSize={4} />}
          Preview messages
        </Flex>
        <Flex
          as="button"
          flex="1"
          align="center"
          justify="center"
          py={3}
          borderRadius="12px"
          border="1px solid #374151"
          color="#9ca3af"
          fontWeight="600"
          fontSize="sm"
          _hover={{ borderColor: '#6b7280', color: 'white' }}
          onClick={() => handleSubmit(false)}
        >
          Save as draft
        </Flex>
        <Flex
          as="button"
          flex="2"
          align="center"
          justify="center"
          gap={2}
          py={3}
          borderRadius="12px"
          bg="linear-gradient(135deg, #25D366, #128C7E)"
          color="white"
          fontWeight="700"
          fontSize="sm"
          transition="all 0.3s"
          opacity={createMutation.isPending ? 0.7 : 1}
          _hover={{ transform: 'translateY(-1px)', boxShadow: '0 4px 20px rgba(37,211,102,0.3)' }}
          onClick={() => !createMutation.isPending && handleSubmit(true)}
        >
          <Icon as={FiSend} boxSize={4} />
          {createMutation.isPending
            ? 'Creating…'
            : sendMode === 'now'
            ? 'Create & Send Now'
            : sendMode === 'daily'
            ? `Create & Schedule ${rangeDays * filledRecipients.length || ''} Messages`.trim()
            : 'Create & Schedule'}
        </Flex>
      </Flex>
    </Box>
  );
}
