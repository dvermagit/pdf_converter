import { Box, Flex, Text, Icon } from '@chakra-ui/react';
import { FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import type { ValidationError } from '../../types';

interface ValidationResultsProps {
  errors: ValidationError[];
  totalRows: number;
  isValid: boolean;
  preview?: Array<{ rowNumber: number; data: Record<string, unknown> }>;
}

export function ValidationResults({
  errors,
  totalRows,
  isValid,
  preview,
}: ValidationResultsProps) {
  return (
    <Box>
      {/* Summary */}
      <Flex
        align="center"
        gap={3}
        p={4}
        borderRadius="12px"
        bg={isValid ? 'rgba(37,211,102,0.08)' : 'rgba(244,63,94,0.08)'}
        border="1px solid"
        borderColor={isValid ? 'rgba(37,211,102,0.2)' : 'rgba(244,63,94,0.2)'}
        mb={6}
      >
        <Icon
          as={isValid ? FiCheckCircle : FiAlertCircle}
          color={isValid ? '#25D366' : '#f43f5e'}
          boxSize={5}
        />
        <Box>
          <Text fontSize="sm" fontWeight="700" color="white">
            {isValid
              ? `All ${totalRows} rows validated successfully`
              : `${errors.length} validation error(s) found`}
          </Text>
          <Text fontSize="xs" color="#6b7280">
            {isValid
              ? 'Your data is ready to schedule.'
              : 'Fix the errors below and re-upload.'}
          </Text>
        </Box>
      </Flex>

      {/* Errors */}
      {errors.length > 0 && (
        <Box mb={6}>
          <Text fontSize="sm" fontWeight="700" color="white" mb={3}>
            Errors
          </Text>
          <Flex direction="column" gap={2} maxH="300px" overflowY="auto">
            {errors.map((error, idx) => (
              <Flex
                key={idx}
                align="flex-start"
                gap={3}
                bg="#111827"
                border="1px solid"
                borderColor="rgba(244,63,94,0.2)"
                borderRadius="10px"
                p={3}
              >
                <Text fontSize="xs" color="#f43f5e" fontWeight="700" flexShrink={0} mt={0.5}>
                  Row {error.row}
                </Text>
                <Box>
                  <Text fontSize="xs" color="#9ca3af">
                    <Text as="span" color="white" fontWeight="600">
                      {error.column}
                    </Text>
                    {error.value && (
                      <Text as="span" color="#6b7280">
                        {' '}
                        — "{error.value}"
                      </Text>
                    )}
                  </Text>
                  <Text fontSize="xs" color="#f43f5e">
                    {error.reason}
                  </Text>
                </Box>
              </Flex>
            ))}
          </Flex>
        </Box>
      )}

      {/* Preview Table */}
      {preview && preview.length > 0 && (
        <Box>
          <Text fontSize="sm" fontWeight="700" color="white" mb={3}>
            Data Preview (first {preview.length} rows)
          </Text>
          <Box overflowX="auto" borderRadius="12px" border="1px solid" borderColor="#1f2937">
            <Box as="table" w="full" fontSize="xs">
              <Box as="thead">
                <Box as="tr" bg="#1a2332">
                  {Object.keys(preview[0].data)
                    .filter((k) => !k.startsWith('__'))
                    .map((header) => (
                      <Box
                        as="th"
                        key={header}
                        px={3}
                        py={2.5}
                        textAlign="left"
                        color="#9ca3af"
                        fontWeight="600"
                        textTransform="uppercase"
                        letterSpacing="0.05em"
                        whiteSpace="nowrap"
                      >
                        {header}
                      </Box>
                    ))}
                </Box>
              </Box>
              <Box as="tbody">
                {preview.map((row) => (
                  <Box
                    as="tr"
                    key={row.rowNumber}
                    borderTop="1px solid"
                    borderColor="#1f2937"
                    _hover={{ bg: 'rgba(255,255,255,0.02)' }}
                  >
                    {Object.entries(row.data)
                      .filter(([k]) => !k.startsWith('__'))
                      .map(([key, value]) => (
                        <Box
                          as="td"
                          key={key}
                          px={3}
                          py={2.5}
                          color="white"
                          whiteSpace="nowrap"
                          maxW="200px"
                          overflow="hidden"
                          textOverflow="ellipsis"
                        >
                          {String(value ?? '')}
                        </Box>
                      ))}
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
