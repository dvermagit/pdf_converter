import { useState } from 'react';
import { Box, Flex, Text, Icon } from '@chakra-ui/react';
import { FiArrowRight, FiCheck } from 'react-icons/fi';
import { SelectField } from '../ui/fields';
import type { ColumnMapping } from '../../types';

const REQUIRED_FIELDS = [
  { key: 'recipientName', label: 'Recipient Name', description: 'Name of the recipient' },
  { key: 'phoneNumber', label: 'Phone Number', description: 'Mobile number (E.164)' },
  { key: 'dateOfBirth', label: 'Date of Birth', description: 'DOB for personalization' },
  { key: 'message', label: 'Message', description: 'WhatsApp message text' },
  { key: 'scheduledAt', label: 'Scheduled Time', description: 'When to send' },
];

interface ColumnMapperProps {
  headers: string[];
  onMappingComplete: (mapping: ColumnMapping, outputColumns: string[]) => void;
}

export function ColumnMapper({ headers, onMappingComplete }: ColumnMapperProps) {
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [selectedOutputColumns, setSelectedOutputColumns] = useState<string[]>(headers);

  const allMapped = REQUIRED_FIELDS.every((field) => mapping[field.key]);

  const handleSelect = (fieldKey: string, header: string) => {
    setMapping((prev) => ({ ...prev, [fieldKey]: header }));
  };

  const toggleOutputColumn = (header: string) => {
    setSelectedOutputColumns((prev) =>
      prev.includes(header) ? prev.filter((h) => h !== header) : [...prev, header]
    );
  };

  return (
    <Box>
      {/* Required Field Mapping */}
      <Text fontSize="md" fontWeight="700" color="white" mb={4}>
        Map Excel Columns
      </Text>
      <Text fontSize="sm" color="#6b7280" mb={6}>
        Match your Excel columns to the required fields below.
      </Text>

      <Flex direction="column" gap={3} mb={8}>
        {REQUIRED_FIELDS.map((field) => (
          <Flex
            key={field.key}
            align="center"
            gap={4}
            bg="#111827"
            border="1px solid"
            borderColor={mapping[field.key] ? '#25D366' : '#1f2937'}
            borderRadius="12px"
            p={4}
            transition="all 0.2s"
          >
            {/* Field label */}
            <Box flex="1">
              <Flex align="center" gap={2}>
                {mapping[field.key] && (
                  <Icon as={FiCheck} color="#25D366" boxSize={4} />
                )}
                <Text fontSize="sm" fontWeight="600" color="white">
                  {field.label}
                </Text>
              </Flex>
              <Text fontSize="xs" color="#6b7280">
                {field.description}
              </Text>
            </Box>

            {/* Arrow */}
            <Icon as={FiArrowRight} color="#374151" boxSize={4} />

            {/* Header selector */}
            <Box flex="1">
              <SelectField
                w="full"
                bg="#0a0e17"
                color="white"
                border="1px solid"
                borderColor="#374151"
                borderRadius="8px"
                p={2}
                fontSize="sm"
                outline="none"
                value={mapping[field.key] || ''}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  handleSelect(field.key, e.target.value)
                }
                css={{
                  '& option': {
                    background: '#111827',
                    color: 'white',
                  },
                }}
              >
                <option value="">— Select column —</option>
                {headers.map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </SelectField>
            </Box>
          </Flex>
        ))}
      </Flex>

      {/* Output Column Selection */}
      <Text fontSize="md" fontWeight="700" color="white" mb={3}>
        Output Columns
      </Text>
      <Text fontSize="sm" color="#6b7280" mb={4}>
        Select which columns to include in each recipient's personalized Excel.
      </Text>
      <Flex flexWrap="wrap" gap={2} mb={6}>
        {headers.map((header) => {
          const isSelected = selectedOutputColumns.includes(header);
          return (
            <Box
              key={header}
              as="button"
              px={3}
              py={1.5}
              borderRadius="full"
              fontSize="xs"
              fontWeight="600"
              border="1px solid"
              borderColor={isSelected ? '#25D366' : '#374151'}
              bg={isSelected ? 'rgba(37,211,102,0.1)' : 'transparent'}
              color={isSelected ? '#25D366' : '#9ca3af'}
              transition="all 0.2s"
              _hover={{
                borderColor: isSelected ? '#25D366' : '#6b7280',
              }}
              onClick={() => toggleOutputColumn(header)}
            >
              {header}
            </Box>
          );
        })}
      </Flex>

      {/* Confirm button */}
      <Box
        as="button"
        w="full"
        py={3}
        borderRadius="12px"
        bg={allMapped ? 'linear-gradient(135deg, #25D366, #128C7E)' : '#374151'}
        color="white"
        fontWeight="700"
        fontSize="sm"
        transition="all 0.3s"
        cursor={allMapped ? 'pointer' : 'not-allowed'}
        opacity={allMapped ? 1 : 0.5}
        _hover={allMapped ? { transform: 'translateY(-1px)', boxShadow: '0 4px 20px rgba(37,211,102,0.3)' } : {}}
        onClick={() => {
          if (allMapped) {
            onMappingComplete(mapping as ColumnMapping, selectedOutputColumns);
          }
        }}
      >
        Validate & Preview
      </Box>
    </Box>
  );
}
