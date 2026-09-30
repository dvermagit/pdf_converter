import { useState } from 'react';
import { Box, Flex, Text, Icon, Spinner } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiEdit2, FiTrash2, FiSend, FiCalendar, FiClock } from 'react-icons/fi';
import {
  useTemplates,
  useTemplatePresets,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
} from '../hooks/useTemplates';
import { TemplateEditor } from '../components/templates/TemplateEditor';
import type { Template, TemplateInput, TemplatePreset } from '../types';

function errorMessage(err: unknown, fallback: string): string {
  const response = (err as { response?: { data?: { error?: string } } })?.response;
  return response?.data?.error || fallback;
}

export function TemplatesPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useTemplates();
  const { data: presetData } = useTemplatePresets();
  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();
  const deleteMutation = useDeleteTemplate();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [preset, setPreset] = useState<TemplatePreset | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const templates = data?.templates ?? [];

  const openNew = (fromPreset?: TemplatePreset) => {
    setEditing(null);
    setPreset(fromPreset ?? null);
    setSaveError(null);
    setEditorOpen(true);
  };

  const openEdit = (template: Template) => {
    setEditing(template);
    setPreset(null);
    setSaveError(null);
    setEditorOpen(true);
  };

  const handleSave = async (input: TemplateInput) => {
    setSaveError(null);
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing._id, input });
      } else {
        await createMutation.mutateAsync(input);
      }
      setEditorOpen(false);
      setEditing(null);
      setPreset(null);
    } catch (err) {
      setSaveError(errorMessage(err, 'Failed to save template'));
    }
  };

  return (
    <Box>
      {/* Header */}
      <Flex justify="space-between" align="center" mb={6} wrap="wrap" gap={4}>
        <Box>
          <Text fontSize="2xl" fontWeight="800" color="white" mb={1}>
            Templates
          </Text>
          <Text fontSize="sm" color="#6b7280">
            Reusable messages for Diwali, Holi, birthdays and any other event
          </Text>
        </Box>

        <Box
          as="button"
          display="flex"
          alignItems="center"
          gap={2}
          px={4}
          py={2.5}
          borderRadius="10px"
          bg="linear-gradient(135deg, #25D366, #128C7E)"
          color="white"
          fontSize="sm"
          fontWeight="700"
          transition="all 0.3s"
          _hover={{ transform: 'translateY(-1px)', boxShadow: '0 4px 20px rgba(37,211,102,0.3)' }}
          onClick={() => openNew()}
        >
          <Icon as={FiPlus} boxSize={4} />
          New Template
        </Box>
      </Flex>

      {/* Quick-start presets */}
      {presetData && presetData.presets.length > 0 && (
        <Box
          bg="#111827"
          border="1px solid"
          borderColor="#1f2937"
          borderRadius="16px"
          p={5}
          mb={6}
        >
          <Text fontSize="sm" fontWeight="700" color="white" mb={1}>
            Start from a preset
          </Text>
          <Text fontSize="xs" color="#6b7280" mb={4}>
            Pick an occasion — you can edit the wording, date and send time before saving.
          </Text>
          <Flex gap={2} flexWrap="wrap">
            {presetData.presets.map((p) => (
              <Flex
                key={p.key}
                as="button"
                align="center"
                gap={2}
                px={3}
                py={2}
                borderRadius="10px"
                border="1px solid #374151"
                color="#9ca3af"
                fontSize="sm"
                fontWeight="600"
                transition="all 0.2s"
                _hover={{ borderColor: '#25D366', color: 'white', bg: 'rgba(37,211,102,0.06)' }}
                onClick={() => openNew(p)}
              >
                <Text fontSize="md">{p.emoji}</Text>
                {p.name}
              </Flex>
            ))}
          </Flex>
        </Box>
      )}

      {/* Template grid */}
      {isLoading && !data ? (
        <Flex justify="center" py={10}>
          <Spinner size="lg" color="#25D366" />
        </Flex>
      ) : templates.length === 0 ? (
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
            🎉
          </Text>
          <Text color="#6b7280" fontSize="md" fontWeight="500" mb={1}>
            No templates yet
          </Text>
          <Text color="#4b5563" fontSize="sm">
            Create one from a preset above, or start from scratch
          </Text>
        </Flex>
      ) : (
        <Box
          display="grid"
          gridTemplateColumns={{ base: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' }}
          gap={4}
        >
          {templates.map((template) => (
            <Flex
              key={template._id}
              direction="column"
              bg="#111827"
              border="1px solid"
              borderColor="#1f2937"
              borderRadius="16px"
              p={5}
              transition="all 0.3s ease"
              _hover={{ borderColor: '#374151', boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}
            >
              <Flex align="flex-start" gap={3} mb={3}>
                <Flex
                  align="center"
                  justify="center"
                  w="40px"
                  h="40px"
                  borderRadius="12px"
                  bg="rgba(37,211,102,0.1)"
                  fontSize="lg"
                  flexShrink={0}
                >
                  {template.emoji}
                </Flex>
                <Box flex="1" overflow="hidden">
                  <Text fontSize="md" fontWeight="700" color="white" truncate>
                    {template.name}
                  </Text>
                  <Text fontSize="xs" color="#25D366" fontWeight="600" truncate>
                    {template.occasion}
                  </Text>
                </Box>
              </Flex>

              {/* Message excerpt */}
              <Box
                bg="#0a0e17"
                border="1px solid #1f2937"
                borderRadius="10px"
                p={3}
                mb={3}
                flex="1"
              >
                <Text
                  fontSize="xs"
                  color="#9ca3af"
                  lineHeight="1.6"
                  lineClamp={4}
                  whiteSpace="pre-wrap"
                >
                  {template.messageBody}
                </Text>
              </Box>

              {/* Meta */}
              <Flex gap={4} mb={4} flexWrap="wrap">
                {template.eventDate && (
                  <Flex align="center" gap={1.5}>
                    <Icon as={FiCalendar} color="#6b7280" boxSize={3.5} />
                    <Text fontSize="xs" color="#9ca3af">
                      {new Date(template.eventDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  </Flex>
                )}
                <Flex align="center" gap={1.5}>
                  <Icon as={FiClock} color="#6b7280" boxSize={3.5} />
                  <Text fontSize="xs" color="#9ca3af">
                    {template.defaultSendTime}
                  </Text>
                </Flex>
                {template.usageCount > 0 && (
                  <Text fontSize="xs" color="#6b7280">
                    Used {template.usageCount}×
                  </Text>
                )}
              </Flex>

              {/* Actions */}
              <Flex gap={2}>
                <Flex
                  as="button"
                  flex="1"
                  align="center"
                  justify="center"
                  gap={2}
                  py={2}
                  borderRadius="10px"
                  bg="linear-gradient(135deg, #25D366, #128C7E)"
                  color="white"
                  fontSize="xs"
                  fontWeight="700"
                  transition="all 0.2s"
                  _hover={{ boxShadow: '0 4px 16px rgba(37,211,102,0.3)' }}
                  onClick={() => navigate(`/campaigns/new?template=${template._id}`)}
                >
                  <Icon as={FiSend} boxSize={3.5} />
                  Use &amp; Add People
                </Flex>
                <Flex
                  as="button"
                  align="center"
                  justify="center"
                  w="36px"
                  py={2}
                  borderRadius="10px"
                  border="1px solid #374151"
                  color="#9ca3af"
                  _hover={{ borderColor: '#6b7280', color: 'white' }}
                  onClick={() => openEdit(template)}
                >
                  <Icon as={FiEdit2} boxSize={3.5} />
                </Flex>
                <Flex
                  as="button"
                  align="center"
                  justify="center"
                  w="36px"
                  py={2}
                  borderRadius="10px"
                  border="1px solid"
                  borderColor={confirmDelete === template._id ? '#f43f5e' : '#374151'}
                  bg={confirmDelete === template._id ? 'rgba(244,63,94,0.1)' : 'transparent'}
                  color={confirmDelete === template._id ? '#f43f5e' : '#9ca3af'}
                  _hover={{ borderColor: '#f43f5e', color: '#f43f5e' }}
                  onClick={() => {
                    if (confirmDelete === template._id) {
                      deleteMutation.mutate(template._id);
                      setConfirmDelete(null);
                    } else {
                      setConfirmDelete(template._id);
                    }
                  }}
                >
                  <Icon as={FiTrash2} boxSize={3.5} />
                </Flex>
              </Flex>
              {confirmDelete === template._id && (
                <Text fontSize="xs" color="#f43f5e" mt={2} textAlign="right">
                  Click again to confirm deletion
                </Text>
              )}
            </Flex>
          ))}
        </Box>
      )}

      {editorOpen && (
        <TemplateEditor
          template={editing}
          preset={preset}
          isSaving={createMutation.isPending || updateMutation.isPending}
          error={saveError}
          onSave={handleSave}
          onClose={() => {
            setEditorOpen(false);
            setEditing(null);
            setPreset(null);
          }}
        />
      )}
    </Box>
  );
}
