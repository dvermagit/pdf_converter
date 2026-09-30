import { useState } from 'react';
import { Box, Flex, Text, Icon } from '@chakra-ui/react';
import { FiX, FiSave } from 'react-icons/fi';
import { TextField, TextAreaField, SelectField, PlainButton } from '../ui/fields';
import type { Template, TemplateInput, TemplatePreset } from '../../types';

const PLACEHOLDERS = ['{{name}}', '{{phone}}', '{{dob}}', '{{eventName}}', '{{eventDate}}'];

const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
  { value: 'America/New_York', label: 'America/New_York (EST)' },
  { value: 'Europe/London', label: 'Europe/London (GMT)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' },
  { value: 'UTC', label: 'UTC' },
];

const EMOJI_CHOICES = ['🎉', '🪔', '🎨', '🎆', '🎂', '📅', '🎁', '🙏', '✨', '💼'];

interface TemplateEditorProps {
  /** Existing template to edit, or a preset to start from. */
  template?: Template | null;
  preset?: TemplatePreset | null;
  isSaving?: boolean;
  error?: string | null;
  onSave: (input: TemplateInput) => void;
  onClose: () => void;
}

export function TemplateEditor({
  template,
  preset,
  isSaving,
  error,
  onSave,
  onClose,
}: TemplateEditorProps) {
  const [form, setForm] = useState<TemplateInput>({
    name: template?.name ?? preset?.name ?? '',
    occasion: template?.occasion ?? preset?.occasion ?? 'custom',
    description: template?.description ?? preset?.description ?? '',
    messageBody: template?.messageBody ?? preset?.messageBody ?? '',
    eventDate: template?.eventDate ? template.eventDate.slice(0, 10) : '',
    defaultSendTime: template?.defaultSendTime ?? preset?.defaultSendTime ?? '10:00',
    timezone: template?.timezone ?? 'Asia/Kolkata',
    emoji: template?.emoji ?? preset?.emoji ?? '🎉',
  });

  const set = <K extends keyof TemplateInput>(key: K, value: TemplateInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const canSave = form.name.trim().length > 0 && form.messageBody.trim().length > 0;

  const insertPlaceholder = (placeholder: string) => {
    set('messageBody', `${form.messageBody}${placeholder}`);
  };

  return (
    <Flex
      position="fixed"
      inset="0"
      bg="rgba(0,0,0,0.7)"
      zIndex="modal"
      align="flex-start"
      justify="center"
      p={4}
      overflowY="auto"
      onClick={onClose}
    >
      <Box
        bg="#111827"
        border="1px solid"
        borderColor="#1f2937"
        borderRadius="20px"
        p={6}
        w="full"
        maxW="640px"
        my={8}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <Flex justify="space-between" align="center" mb={6}>
          <Box>
            <Text fontSize="lg" fontWeight="800" color="white">
              {template ? 'Edit Template' : 'New Template'}
            </Text>
            <Text fontSize="sm" color="#6b7280">
              Reusable message for a festival, event or occasion
            </Text>
          </Box>
          <Icon
            as={FiX}
            boxSize={5}
            color="#6b7280"
            cursor="pointer"
            _hover={{ color: 'white' }}
            onClick={onClose}
          />
        </Flex>

        <Flex direction="column" gap={4}>
          {/* Name + emoji */}
          <Flex gap={3} align="flex-end">
            <Box flex="1">
              <Text fontSize="xs" fontWeight="600" color="#9ca3af" mb={1.5}>
                Template Name
              </Text>
              <TextField
                placeholder="Diwali Greetings 2026"
                value={form.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('name', e.target.value)}
              />
            </Box>
            <Box>
              <Text fontSize="xs" fontWeight="600" color="#9ca3af" mb={1.5}>
                Icon
              </Text>
              <Flex gap={1} flexWrap="wrap" maxW="180px">
                {EMOJI_CHOICES.map((emoji) => (
                  <PlainButton
                    key={emoji}
                    type="button"
                    w="30px"
                    h="30px"
                    borderRadius="8px"
                    fontSize="sm"
                    border="1px solid"
                    borderColor={form.emoji === emoji ? '#25D366' : '#374151'}
                    bg={form.emoji === emoji ? 'rgba(37,211,102,0.1)' : 'transparent'}
                    onClick={() => set('emoji', emoji)}
                  >
                    {emoji}
                  </PlainButton>
                ))}
              </Flex>
            </Box>
          </Flex>

          {/* Occasion + description */}
          <Flex gap={3} direction={{ base: 'column', md: 'row' }}>
            <Box flex="1">
              <Text fontSize="xs" fontWeight="600" color="#9ca3af" mb={1.5}>
                Occasion
              </Text>
              <TextField
                placeholder="Diwali, Holi, Anniversary…"
                value={form.occasion}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  set('occasion', e.target.value)
                }
              />
            </Box>
            <Box flex="2">
              <Text fontSize="xs" fontWeight="600" color="#9ca3af" mb={1.5}>
                Description <Text as="span" color="#4b5563">(optional)</Text>
              </Text>
              <TextField
                placeholder="What this template is used for"
                value={form.description}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  set('description', e.target.value)
                }
              />
            </Box>
          </Flex>

          {/* Event date + time + timezone */}
          <Flex gap={3} direction={{ base: 'column', md: 'row' }}>
            <Box flex="1">
              <Text fontSize="xs" fontWeight="600" color="#9ca3af" mb={1.5}>
                Event Date <Text as="span" color="#4b5563">(optional)</Text>
              </Text>
              <TextField
                type="date"
                css={{ colorScheme: 'dark' }}
                value={form.eventDate || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  set('eventDate', e.target.value)
                }
              />
            </Box>
            <Box flex="1">
              <Text fontSize="xs" fontWeight="600" color="#9ca3af" mb={1.5}>
                Default Send Time
              </Text>
              <TextField
                type="time"
                css={{ colorScheme: 'dark' }}
                value={form.defaultSendTime}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  set('defaultSendTime', e.target.value)
                }
              />
            </Box>
            <Box flex="1.4">
              <Text fontSize="xs" fontWeight="600" color="#9ca3af" mb={1.5}>
                Timezone
              </Text>
              <SelectField
                value={form.timezone}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  set('timezone', e.target.value)
                }
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

          {/* Message body */}
          <Box>
            <Flex justify="space-between" align="center" mb={1.5} wrap="wrap" gap={2}>
              <Text fontSize="xs" fontWeight="600" color="#9ca3af">
                Message
              </Text>
              <Flex gap={1.5} flexWrap="wrap">
                {PLACEHOLDERS.map((placeholder) => (
                  <PlainButton
                    key={placeholder}
                    type="button"
                    px={2}
                    py={0.5}
                    borderRadius="full"
                    fontSize="10px"
                    fontWeight="600"
                    border="1px solid #374151"
                    color="#9ca3af"
                    _hover={{ borderColor: '#25D366', color: '#25D366' }}
                    onClick={() => insertPlaceholder(placeholder)}
                  >
                    {placeholder}
                  </PlainButton>
                ))}
              </Flex>
            </Flex>
            <TextAreaField
              rows={8}
              lineHeight="1.6"
              resize="vertical"
              placeholder="Hi {{name}}, wishing you a very Happy Diwali!"
              value={form.messageBody}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                set('messageBody', e.target.value)
              }
            />
            <Text fontSize="xs" color="#4b5563" mt={1.5}>
              Placeholders are filled in per recipient when the campaign is created.
            </Text>
          </Box>

          {error && (
            <Box
              p={3}
              bg="rgba(244,63,94,0.08)"
              border="1px solid rgba(244,63,94,0.2)"
              borderRadius="10px"
            >
              <Text color="#f43f5e" fontSize="sm" fontWeight="600">
                {error}
              </Text>
            </Box>
          )}

          {/* Actions */}
          <Flex gap={3} mt={2}>
            <Box
              as="button"
              flex="1"
              py={3}
              borderRadius="12px"
              bg="#1f2937"
              color="#9ca3af"
              fontWeight="600"
              fontSize="sm"
              _hover={{ bg: '#374151' }}
              onClick={onClose}
            >
              Cancel
            </Box>
            <Box
              as="button"
              flex="2"
              py={3}
              borderRadius="12px"
              bg={canSave ? 'linear-gradient(135deg, #25D366, #128C7E)' : '#374151'}
              color="white"
              fontWeight="700"
              fontSize="sm"
              opacity={canSave && !isSaving ? 1 : 0.6}
              cursor={canSave && !isSaving ? 'pointer' : 'not-allowed'}
              display="flex"
              alignItems="center"
              justifyContent="center"
              gap={2}
              onClick={() => {
                if (canSave && !isSaving) {
                  onSave({ ...form, eventDate: form.eventDate || null });
                }
              }}
            >
              <Icon as={FiSave} boxSize={4} />
              {isSaving ? 'Saving…' : template ? 'Save Changes' : 'Create Template'}
            </Box>
          </Flex>
        </Flex>
      </Box>
    </Flex>
  );
}
