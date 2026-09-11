import { useCallback, useRef, useState } from 'react';
import { Box, Text, VStack, Icon } from '@chakra-ui/react';
import { FiUploadCloud } from 'react-icons/fi';

interface FileDropzoneProps {
  accept: string;
  multiple?: boolean;
  onFilesSelected: (files: File[]) => void;
  label?: string;
  maxFiles?: number;
}

export function FileDropzone({
  accept,
  multiple = false,
  onFilesSelected,
  label = 'Drag & drop your file here, or click to browse',
  maxFiles,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      const limited = maxFiles ? files.slice(0, maxFiles) : files;
      onFilesSelected(limited);
    },
    [onFilesSelected, maxFiles]
  );

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const limited = maxFiles ? files.slice(0, maxFiles) : files;
      onFilesSelected(limited);
    }
  };

  return (
    <Box
      id="file-dropzone"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      cursor="pointer"
      border="2px dashed"
      borderColor={isDragging ? 'blue.400' : 'gray.300'}
      borderRadius="xl"
      p={10}
      textAlign="center"
      transition="all 0.2s"
      bg={isDragging ? 'blue.50' : 'gray.50'}
      _hover={{ borderColor: 'blue.400', bg: 'blue.50' }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleInputChange}
        style={{ display: 'none' }}
      />
      <VStack gap={3}>
        <Icon fontSize="3xl" color="blue.400">
          <FiUploadCloud />
        </Icon>
        <Text color="gray.600" fontWeight="medium">
          {label}
        </Text>
        <Text color="gray.400" fontSize="sm">
          Supported: {accept}
        </Text>
      </VStack>
    </Box>
  );
}
