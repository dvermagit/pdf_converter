import { useState } from 'react';
import { Box, Heading, Text, VStack, Button, HStack, IconButton } from '@chakra-ui/react';
import { saveAs } from 'file-saver';
import { FiTrash2, FiArrowUp, FiArrowDown } from 'react-icons/fi';
import { FileDropzone } from '../components/FileDropzone';
import { mergePdfs } from '../utils/pdfMerge';

export function PdfMerge() {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleFiles = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
    setError(null);
    setDone(false);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const moveFile = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= files.length) return;
    const newFiles = [...files];
    [newFiles[index], newFiles[newIndex]] = [newFiles[newIndex], newFiles[index]];
    setFiles(newFiles);
  };

  const handleMerge = async () => {
    if (files.length < 2) return;
    setLoading(true);
    setError(null);
    try {
      const blob = await mergePdfs(files);
      saveAs(blob, 'merged.pdf');
      setDone(true);
    } catch (err) {
      console.error(err);
      setError('Failed to merge PDFs. Please check your files.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box maxW="700px" mx="auto" py={10} px={6}>
      <VStack gap={6} align="stretch">
        <Box>
          <Heading as="h1" size="xl" color="gray.800" mb={2}>
            PDF Merge
          </Heading>
          <Text color="gray.500">
            Combine multiple PDF files into a single document. Reorder them before merging.
          </Text>
        </Box>

        <FileDropzone
          accept=".pdf"
          multiple
          onFilesSelected={handleFiles}
          label="Drop PDF files here (select multiple)"
        />

        {files.length > 0 && (
          <VStack gap={2} align="stretch">
            <Text fontWeight="bold" color="gray.700">
              Files to merge ({files.length}):
            </Text>
            {files.map((file, index) => (
              <HStack
                key={`${file.name}-${index}`}
                p={3}
                bg="gray.50"
                borderRadius="lg"
                justify="space-between"
              >
                <Text fontSize="sm" color="gray.700" truncate>
                  {index + 1}. {file.name}
                </Text>
                <HStack gap={1}>
                  <IconButton
                    aria-label="Move up"
                    size="xs"
                    variant="ghost"
                    onClick={() => moveFile(index, -1)}
                    disabled={index === 0}
                  >
                    <FiArrowUp />
                  </IconButton>
                  <IconButton
                    aria-label="Move down"
                    size="xs"
                    variant="ghost"
                    onClick={() => moveFile(index, 1)}
                    disabled={index === files.length - 1}
                  >
                    <FiArrowDown />
                  </IconButton>
                  <IconButton
                    aria-label="Remove"
                    size="xs"
                    variant="ghost"
                    colorPalette="red"
                    onClick={() => removeFile(index)}
                  >
                    <FiTrash2 />
                  </IconButton>
                </HStack>
              </HStack>
            ))}
          </VStack>
        )}

        {error && (
          <Box p={4} bg="red.50" borderRadius="lg">
            <Text color="red.600">{error}</Text>
          </Box>
        )}

        {done && (
          <Box p={4} bg="green.50" borderRadius="lg">
            <Text color="green.600">✅ PDFs merged! Your file has been downloaded.</Text>
          </Box>
        )}

        <Button
          colorPalette="teal"
          size="lg"
          onClick={handleMerge}
          disabled={files.length < 2 || loading}
          loading={loading}
          loadingText="Merging..."
          w="full"
        >
          Merge {files.length} PDF{files.length !== 1 ? 's' : ''}
        </Button>
      </VStack>
    </Box>
  );
}
