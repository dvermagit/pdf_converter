import { useState } from 'react';
import { Box, Heading, Text, VStack, Button } from '@chakra-ui/react';
import { saveAs } from 'file-saver';
import { FileDropzone } from '../components/FileDropzone';
import { pdfToWord } from '../utils/pdfToWord';

export function PdfToWord() {
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
      const blob = await pdfToWord(file);
      const name = file.name.replace(/\.pdf$/i, '') + '.docx';
      saveAs(blob, name);
      setDone(true);
    } catch (err) {
      console.error(err);
      setError('Failed to convert PDF. Please try a different file.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box maxW="700px" mx="auto" py={10} px={6}>
      <VStack gap={6} align="stretch">
        <Box>
          <Heading as="h1" size="xl" color="gray.800" mb={2}>
            PDF to Word
          </Heading>
          <Text color="gray.500">
            Convert your PDF to an editable Word document (.docx). Text content will be extracted and preserved.
          </Text>
        </Box>

        <FileDropzone
          accept=".pdf"
          onFilesSelected={handleFiles}
          label="Drop your PDF file here"
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
          colorPalette="blue"
          size="lg"
          onClick={handleConvert}
          disabled={!file || loading}
          loading={loading}
          loadingText="Converting..."
          w="full"
        >
          Convert to Word
        </Button>
      </VStack>
    </Box>
  );
}
