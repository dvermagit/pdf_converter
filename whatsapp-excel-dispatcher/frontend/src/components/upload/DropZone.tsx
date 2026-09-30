import { useCallback, useState } from 'react';
import { Box, Flex, Text, Icon, Input } from '@chakra-ui/react';
import { FiUploadCloud, FiFile, FiX } from 'react-icons/fi';

interface DropZoneProps {
  onFileSelect: (file: File) => void;
  isLoading?: boolean;
  acceptedFile?: File | null;
  onClear?: () => void;
}

export function DropZone({ onFileSelect, isLoading, acceptedFile, onClear }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect]
  );

  if (acceptedFile) {
    return (
      <Box
        bg="#111827"
        border="2px solid"
        borderColor="#25D366"
        borderRadius="16px"
        p={6}
        position="relative"
      >
        <Flex align="center" gap={4}>
          <Flex
            align="center"
            justify="center"
            w="48px"
            h="48px"
            borderRadius="12px"
            bg="rgba(37,211,102,0.1)"
          >
            <Icon as={FiFile} color="#25D366" boxSize={6} />
          </Flex>
          <Box flex="1">
            <Text fontSize="sm" fontWeight="600" color="white">
              {acceptedFile.name}
            </Text>
            <Text fontSize="xs" color="#6b7280">
              {(acceptedFile.size / 1024).toFixed(1)} KB
            </Text>
          </Box>
          {onClear && (
            <Box
              as="button"
              onClick={onClear}
              p={2}
              borderRadius="8px"
              color="#6b7280"
              transition="all 0.2s"
              _hover={{ bg: 'rgba(244,63,94,0.1)', color: '#f43f5e' }}
            >
              <Icon as={FiX} boxSize={5} />
            </Box>
          )}
        </Flex>
      </Box>
    );
  }

  return (
    <Box
      bg={isDragging ? 'rgba(37,211,102,0.05)' : '#111827'}
      border="2px dashed"
      borderColor={isDragging ? '#25D366' : '#1f2937'}
      borderRadius="16px"
      p={10}
      textAlign="center"
      cursor={isLoading ? 'wait' : 'pointer'}
      transition="all 0.3s ease"
      _hover={{
        borderColor: '#374151',
        bg: 'rgba(255,255,255,0.02)',
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => {
        if (!isLoading) document.getElementById('file-input')?.click();
      }}
      role="button"
      tabIndex={0}
      position="relative"
    >
      <Input
        id="file-input"
        type="file"
        accept=".xlsx,.xls"
        onChange={handleInputChange}
        display="none"
      />

      <Flex direction="column" align="center" gap={3}>
        <Flex
          align="center"
          justify="center"
          w="64px"
          h="64px"
          borderRadius="16px"
          bg={isDragging ? 'rgba(37,211,102,0.15)' : 'rgba(107,114,128,0.1)'}
          transition="all 0.3s"
        >
          <Icon
            as={FiUploadCloud}
            boxSize={8}
            color={isDragging ? '#25D366' : '#6b7280'}
            transition="all 0.3s"
          />
        </Flex>
        <Box>
          <Text fontSize="sm" fontWeight="600" color="white" mb={1}>
            {isDragging ? 'Drop your Excel file here' : 'Drag & drop your Excel file'}
          </Text>
          <Text fontSize="xs" color="#6b7280">
            or click to browse · Supports .xlsx and .xls
          </Text>
        </Box>
      </Flex>

      {isLoading && (
        <Box
          position="absolute"
          inset="0"
          bg="rgba(0,0,0,0.5)"
          borderRadius="16px"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <Text color="white" fontSize="sm" fontWeight="600">
            Uploading...
          </Text>
        </Box>
      )}
    </Box>
  );
}
