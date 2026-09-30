import { useState } from 'react';
import { Box, Flex, Text, Icon } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { FiCheck, FiChevronRight, FiEdit3 } from 'react-icons/fi';
import { DropZone } from '../components/upload/DropZone';
import { ColumnMapper } from '../components/upload/ColumnMapper';
import { ValidationResults } from '../components/upload/ValidationResults';
import { useUpload } from '../hooks/useUpload';
import { startCampaign } from '../services/api';
import { SelectField } from '../components/ui/fields';
import type { ColumnMapping } from '../types';

const STEPS = [
  { label: 'Upload', description: 'Upload master Excel' },
  { label: 'Map Columns', description: 'Map fields' },
  { label: 'Preview', description: 'Validate & review' },
  { label: 'Confirm', description: 'Schedule campaign' },
];

export function UploadPage() {
  const navigate = useNavigate();
  const upload = useUpload();
  const [currentStep, setCurrentStep] = useState(0);
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [isStarting, setIsStarting] = useState(false);

  const handleFileSelect = async (file: File) => {
    await upload.uploadFile(file);
    setCurrentStep(1);
  };

  const handleMappingComplete = async (mapping: ColumnMapping, outputColumns: string[]) => {
    await upload.validateMapping(mapping, timezone, outputColumns);
    setCurrentStep(2);
  };

  const handleConfirm = async () => {
    if (!upload.uploadResponse?.campaign._id) return;
    setIsStarting(true);
    try {
      await startCampaign(upload.uploadResponse.campaign._id);
      setCurrentStep(3);
      setTimeout(() => {
        navigate(`/campaigns/${upload.uploadResponse!.campaign._id}`);
      }, 2000);
    } catch (err) {
      console.error('Failed to start campaign:', err);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <Box maxW="800px" mx="auto">
      {/* Header */}
      <Flex justify="space-between" align="flex-start" mb={8} wrap="wrap" gap={4}>
        <Box>
          <Text fontSize="2xl" fontWeight="800" color="white" mb={1}>
            New Campaign
          </Text>
          <Text fontSize="sm" color="#6b7280">
            Upload your master Excel and schedule WhatsApp deliveries
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
          _hover={{ borderColor: '#25D366', color: '#25D366' }}
          onClick={() => navigate('/campaigns/new')}
        >
          <Icon as={FiEdit3} boxSize={4} />
          Add people manually instead
        </Flex>
      </Flex>

      {/* Step Indicator */}
      <Flex mb={8} gap={0}>
        {STEPS.map((step, idx) => {
          const isActive = idx === currentStep;
          const isCompleted = idx < currentStep;

          return (
            <Flex key={step.label} align="center" flex="1">
              <Flex align="center" gap={2}>
                <Flex
                  align="center"
                  justify="center"
                  w="32px"
                  h="32px"
                  borderRadius="full"
                  bg={
                    isCompleted
                      ? '#25D366'
                      : isActive
                      ? 'rgba(37,211,102,0.15)'
                      : '#1f2937'
                  }
                  border="2px solid"
                  borderColor={
                    isCompleted ? '#25D366' : isActive ? '#25D366' : '#374151'
                  }
                  transition="all 0.3s"
                >
                  {isCompleted ? (
                    <Icon as={FiCheck} color="white" boxSize={4} />
                  ) : (
                    <Text
                      fontSize="xs"
                      fontWeight="700"
                      color={isActive ? '#25D366' : '#6b7280'}
                    >
                      {idx + 1}
                    </Text>
                  )}
                </Flex>
                <Box display={{ base: 'none', md: 'block' }}>
                  <Text
                    fontSize="xs"
                    fontWeight="600"
                    color={isActive || isCompleted ? 'white' : '#6b7280'}
                  >
                    {step.label}
                  </Text>
                </Box>
              </Flex>
              {idx < STEPS.length - 1 && (
                <Box flex="1" mx={2}>
                  <Box
                    h="2px"
                    bg={isCompleted ? '#25D366' : '#1f2937'}
                    borderRadius="full"
                    transition="all 0.3s"
                  />
                </Box>
              )}
            </Flex>
          );
        })}
      </Flex>

      {/* Step Content */}
      <Box
        bg="#111827"
        border="1px solid"
        borderColor="#1f2937"
        borderRadius="20px"
        p={{ base: 5, md: 8 }}
      >
        {/* Step 0: Upload */}
        {currentStep === 0 && (
          <Box>
            <Text fontSize="md" fontWeight="700" color="white" mb={2}>
              Upload Master Excel
            </Text>
            <Text fontSize="sm" color="#6b7280" mb={6}>
              Upload the Excel file containing all recipient details, messages, and scheduled times.
            </Text>
            <DropZone
              onFileSelect={handleFileSelect}
              isLoading={upload.isLoading}
              acceptedFile={upload.file}
              onClear={upload.reset}
            />
          </Box>
        )}

        {/* Step 1: Column Mapping */}
        {currentStep === 1 && (
          <Box>
            {upload.headers.length > 0 ? (
              <>
                {/* Timezone selector */}
                <Flex align="center" gap={3} mb={6}>
                  <Text fontSize="sm" fontWeight="600" color="white">
                    Campaign Timezone:
                  </Text>
                  <SelectField
                    bg="#0a0e17"
                    color="white"
                    border="1px solid"
                    borderColor="#374151"
                    borderRadius="8px"
                    px={3}
                    py={2}
                    fontSize="sm"
                    value={timezone}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setTimezone(e.target.value)
                    }
                    css={{ '& option': { background: '#111827', color: 'white' } }}
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                    <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                    <option value="UTC">UTC</option>
                  </SelectField>
                </Flex>

                <ColumnMapper
                  headers={upload.headers}
                  onMappingComplete={handleMappingComplete}
                />
              </>
            ) : (
              <Box
                mt={4}
                p={6}
                bg="rgba(244,63,94,0.08)"
                border="1px solid rgba(244,63,94,0.2)"
                borderRadius="12px"
                textAlign="center"
              >
                <Text color="#f43f5e" fontSize="md" fontWeight="600" mb={2}>
                  No columns found in the Excel file!
                </Text>
                <Text color="#9ca3af" fontSize="sm" mb={4}>
                  Please ensure the first row of your Excel file contains column headers (like Name, Phone Number, etc.).
                </Text>
                <Box
                  as="button"
                  px={4}
                  py={2}
                  borderRadius="8px"
                  bg="#1f2937"
                  color="white"
                  fontSize="sm"
                  fontWeight="600"
                  onClick={() => setCurrentStep(0)}
                >
                  Upload a different file
                </Box>
              </Box>
            )}
          </Box>
        )}

        {/* Step 2: Preview */}
        {currentStep === 2 && upload.uploadResponse?.validation && (
          <Box>
            <ValidationResults
              errors={upload.uploadResponse.validation.errors}
              totalRows={upload.uploadResponse.validation.totalRows}
              isValid={upload.uploadResponse.validation.isValid}
              preview={upload.uploadResponse.validation.preview}
            />

            {upload.uploadResponse.validation.isValid && (
              <Flex gap={3} mt={6}>
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
                  onClick={() => setCurrentStep(1)}
                >
                  Back to Mapping
                </Box>
                <Box
                  as="button"
                  flex="2"
                  py={3}
                  borderRadius="12px"
                  bg="linear-gradient(135deg, #25D366, #128C7E)"
                  color="white"
                  fontWeight="700"
                  fontSize="sm"
                  cursor={isStarting ? 'wait' : 'pointer'}
                  transition="all 0.3s"
                  _hover={{
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 20px rgba(37,211,102,0.3)',
                  }}
                  onClick={handleConfirm}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  gap={2}
                >
                  {isStarting ? 'Scheduling...' : 'Confirm & Schedule Campaign'}
                  <Icon as={FiChevronRight} boxSize={4} />
                </Box>
              </Flex>
            )}
          </Box>
        )}

        {/* Step 3: Confirmed */}
        {currentStep === 3 && (
          <Flex direction="column" align="center" py={10}>
            <Flex
              align="center"
              justify="center"
              w="64px"
              h="64px"
              borderRadius="full"
              bg="rgba(37,211,102,0.15)"
              mb={4}
            >
              <Icon as={FiCheck} color="#25D366" boxSize={8} />
            </Flex>
            <Text fontSize="lg" fontWeight="700" color="white" mb={2}>
              Campaign Scheduled!
            </Text>
            <Text fontSize="sm" color="#6b7280" textAlign="center">
              All recipient deliveries have been queued. Redirecting to campaign details...
            </Text>
          </Flex>
        )}

        {/* Error state */}
        {upload.error && currentStep < 3 && (
          <Box
            mt={4}
            p={4}
            bg="rgba(244,63,94,0.08)"
            border="1px solid rgba(244,63,94,0.2)"
            borderRadius="12px"
          >
            <Text color="#f43f5e" fontSize="sm" fontWeight="600">
              {upload.error}
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
