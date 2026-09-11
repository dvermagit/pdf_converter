import { useState } from 'react';
import { Box, Heading, Text, VStack, Button } from '@chakra-ui/react';
import { saveAs } from 'file-saver';
import { FileDropzone } from '../components/FileDropzone';
import { wordToPdf } from '../utils/wordToPdf';

export function WordToPdf() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleFiles = (files: File[]) => {
    setFile(files[0]);
    setError(null);
    setDone(false);
  };

  const handleConvert = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const blob = await wordToPdf(file);
      const name = file.name.replace(/\.(docx?|doc)$/i, '') + '.pdf';
      saveAs(blob, name);
      setDone(true);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('body element') || msg.includes('docx')) {
        setError('This file could not be read. Please make sure it is a valid .docx file (not .doc).');
      } else if (msg.includes('No content')) {
        setError('The Word file appears to be empty or has no extractable content.');
      } else {
        setError('Failed to convert Word file. Please ensure it is a .docx file and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box maxW="700px" mx="auto" py={10} px={6}>
      <VStack gap={6} align="stretch">
        <Box>
          <Heading as="h1" size="xl" color="gray.800" mb={2}>
            Word to PDF
          </Heading>
          <Text color="gray.500">
            Convert your Word document (.docx) to PDF format.
          </Text>
        </Box>

        <FileDropzone
          accept=".docx"
          onFilesSelected={handleFiles}
          label="Drop your Word file here (.docx only)"
        />

        {file && (
          <Box p={4} bg="gray.50" borderRadius="lg">
            <Text fontWeight="medium" color="gray.700">
              📄 {file.name}{' '}
              <Text as="span" color="gray.400" fontSize="sm">
                ({(file.size / 1024).toFixed(1)} KB)
              </Text>
            </Text>
          </Box>
        )}

        {error && (
          <Box p={4} bg="red.50" borderRadius="lg">
            <Text color="red.600">{error}</Text>
          </Box>
        )}

        {done && (
          <Box p={4} bg="green.50" borderRadius="lg">
            <Text color="green.600">✅ Conversion complete! Your file has been downloaded.</Text>
          </Box>
        )}

        <Button
          colorPalette="purple"
          size="lg"
          onClick={handleConvert}
          disabled={!file || loading}
          loading={loading}
          loadingText="Converting..."
          w="full"
        >
          Convert to PDF
        </Button>
      </VStack>
    </Box>
  );
}
