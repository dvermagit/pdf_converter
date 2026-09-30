import { useRef, useState } from 'react';
import { Box, Flex, Text, Icon, Spinner } from '@chakra-ui/react';
import { FiFileText, FiCheck, FiX } from 'react-icons/fi';
import { importContacts } from '../../services/api';
import { SelectField } from '../ui/fields';
import type { ContactColumnMapping, ImportedContact } from '../../types';

interface ImportContactsPanelProps {
  onImported: (contacts: ImportedContact[]) => void;
}

interface MappingPrompt {
  file: File;
  headers: string[];
  detected: ContactColumnMapping;
  message: string;
}

/**
 * Fills the people list from a spreadsheet. Columns are matched by header name;
 * when that fails the sheet's headers come back with the error so the person can
 * point at the right ones instead of having to edit and re-save their file.
 */
export function ImportContactsPanel({ onImported }: ImportContactsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<MappingPrompt | null>(null);
  const [usedColumns, setUsedColumns] = useState<ContactColumnMapping | null>(null);
  const [mapping, setMapping] = useState<ContactColumnMapping>({});

  const runImport = async (file: File, columns?: ContactColumnMapping) => {
    setIsImporting(true);
    setError(null);
    setSummary(null);
    setUsedColumns(null);

    try {
      const result = await importContacts(file, columns);
      onImported(result.contacts);
      setPrompt(null);
      setMapping({});

      const notes: string[] = [];
      if (result.skippedRows > 0) notes.push(`${result.skippedRows} blank row(s) skipped`);
      if (result.truncated) notes.push('list truncated at the campaign limit');
      if (result.detectedByContent) notes.push('columns matched by their contents');

      setSummary(
        `Added ${result.contacts.length} ${
          result.contacts.length === 1 ? 'person' : 'people'
        } from ${file.name}${notes.length ? ` — ${notes.join(', ')}` : ''}`
      );
      setUsedColumns(result.detected);
    } catch (err) {
      const data = (
        err as {
          response?: {
            data?: { error?: string; headers?: string[]; detected?: ContactColumnMapping };
          };
        }
      )?.response?.data;

      if (data?.headers?.length) {
        // Auto-detection failed — ask which columns to use.
        setPrompt({
          file,
          headers: data.headers,
          detected: data.detected ?? {},
          message: data.error ?? 'Pick the columns to import',
        });
        setMapping(data.detected ?? {});
      } else {
        setError(data?.error || 'Could not read that file');
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so picking the same file twice still fires a change event.
    event.target.value = '';
    if (file) runImport(file);
  };

  return (
    <Box>
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
        transition="all 0.2s"
        _hover={{ borderColor: '#6b7280', color: 'white' }}
        onClick={() => fileInputRef.current?.click()}
      >
        {isImporting ? <Spinner size="xs" /> : <Icon as={FiFileText} boxSize={3.5} />}
        {isImporting ? 'Reading…' : 'Import from Excel'}
      </Flex>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={handleFile}
      />

      {summary && (
        <Box mt={3}>
          <Flex align="center" gap={2}>
            <Icon as={FiCheck} color="#25D366" boxSize={3.5} />
            <Text fontSize="xs" color="#25D366">
              {summary}
            </Text>
          </Flex>
          {usedColumns && (
            <Flex gap={2} mt={2} flexWrap="wrap" pl={5}>
              {(
                [
                  ['Name', usedColumns.name],
                  ['Phone', usedColumns.phone],
                  ['Date of birth', usedColumns.dateOfBirth],
                  ['Send time', usedColumns.scheduledAt],
                ] as const
              )
                .filter(([, column]) => column)
                .map(([label, column]) => (
                  <Text
                    key={label}
                    fontSize="10px"
                    color="#6b7280"
                    border="1px solid #1f2937"
                    borderRadius="full"
                    px={2}
                    py={0.5}
                  >
                    {label} ← <Text as="span" color="#9ca3af">{column}</Text>
                  </Text>
                ))}
            </Flex>
          )}
        </Box>
      )}

      {error && (
        <Flex align="center" gap={2} mt={3}>
          <Icon as={FiX} color="#f43f5e" boxSize={3.5} />
          <Text fontSize="xs" color="#f43f5e">
            {error}
          </Text>
        </Flex>
      )}

      {/* Column picker, shown only when the headers could not be matched */}
      {prompt && (
        <Box
          mt={3}
          p={4}
          bg="#0a0e17"
          border="1px solid"
          borderColor="rgba(244,63,94,0.25)"
          borderRadius="12px"
        >
          <Text fontSize="xs" color="#f43f5e" fontWeight="600" mb={1}>
            {prompt.message}
          </Text>
          <Text fontSize="xs" color="#6b7280" mb={3}>
            {prompt.file.name} — columns found: {prompt.headers.join(', ')}
          </Text>

          <Flex gap={2} direction={{ base: 'column', md: 'row' }} mb={3}>
            {(
              [
                { key: 'name', label: 'Name column', required: false },
                { key: 'phone', label: 'Phone column', required: true },
                { key: 'dateOfBirth', label: 'Date of birth', required: false },
                { key: 'scheduledAt', label: 'Send time', required: false },
              ] as const
            ).map((field) => (
              <Box key={field.key} flex="1">
                <Text fontSize="10px" fontWeight="700" color="#6b7280" mb={1}>
                  {field.label.toUpperCase()}
                  {field.required && <Text as="span" color="#f43f5e"> *</Text>}
                </Text>
                <SelectField
                  value={mapping[field.key] || ''}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                >
                  <option value="">— none —</option>
                  {prompt.headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </SelectField>
              </Box>
            ))}
          </Flex>

          <Flex gap={2}>
            <Box
              as="button"
              px={4}
              py={2}
              borderRadius="10px"
              bg={mapping.phone ? '#25D366' : '#374151'}
              color="white"
              fontSize="xs"
              fontWeight="700"
              opacity={mapping.phone ? 1 : 0.6}
              cursor={mapping.phone ? 'pointer' : 'not-allowed'}
              onClick={() => mapping.phone && runImport(prompt.file, mapping)}
            >
              Import with these columns
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
              onClick={() => {
                setPrompt(null);
                setMapping({});
              }}
            >
              Cancel
            </Box>
          </Flex>
        </Box>
      )}
    </Box>
  );
}
