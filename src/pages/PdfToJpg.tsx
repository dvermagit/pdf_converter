import { useState } from 'react';
import {
  Box,
  Heading,
  Text,
  VStack,
  Button,
  SimpleGrid,
  Image,
  HStack,
} from '@chakra-ui/react';
import { saveAs } from 'file-saver';
import { FileDropzone } from '../components/FileDropzone';
import { pdfToJpg, downloadAllAsZip, type JpgResult } from '../utils/pdfToJpg';

export function PdfToJpg() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<JpgResult[]>([]);

  const handleFiles = (files: File[]) => {
    setFile(files[0]);
    setError(null);
    setResults([]);
  };

  const handleConvert = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const jpgs = await pdfToJpg(file, 0.92, 2.0);
      setResults(jpgs);
    } catch (err) {
      console.error(err);
      setError('Failed to convert PDF. Please try a different file.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadOne = (result: JpgResult) => {
    const name = file!.name.replace(/\.pdf$/i, '') + `_page_${result.pageNumber}.jpg`;
    saveAs(result.blob, name);
  };

  const handleDownloadAll = async () => {
    if (!file || results.length === 0) return;
    const baseName = file.name.replace(/\.pdf$/i, '');
    await downloadAllAsZip(results, baseName);
  };

  return (
    <Box maxW="900px" mx="auto" py={10} px={6}>
      <VStack gap={6} align="stretch">
        <Box>
          <Heading as="h1" size="xl" color="gray.800" mb={2}>
            PDF to JPG
          </Heading>
          <Text color="gray.500">
            Convert each page of your PDF to a high-quality JPG image.
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
              📄 {file.name}
            </Text>
          </Box>
        )}

        {error && (
          <Box p={4} bg="red.50" borderRadius="lg">
            <Text color="red.600">{error}</Text>
          </Box>
        )}

        <Button
          colorPalette="green"
          size="lg"
          onClick={handleConvert}
          disabled={!file || loading}
          loading={loading}
          loadingText="Converting..."
          w="full"
        >
          Convert to JPG
        </Button>

        {results.length > 0 && (
          <VStack gap={4} align="stretch">
            <HStack justify="space-between">
              <Text fontWeight="bold" color="gray.700">
                {results.length} page(s) converted
              </Text>
              <Button size="sm" colorPalette="blue" onClick={handleDownloadAll}>
                Download All (ZIP)
              </Button>
            </HStack>
            <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} gap={4}>
              {results.map((r) => (
                <Box
                  key={r.pageNumber}
                  border="1px solid"
                  borderColor="gray.200"
                  borderRadius="lg"
                  overflow="hidden"
                >
                  <Image
                    src={r.dataUrl}
                    alt={`Page ${r.pageNumber}`}
                    w="full"
                  />
                  <Box p={2} textAlign="center">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => handleDownloadOne(r)}
                    >
                      Download Page {r.pageNumber}
                    </Button>
                  </Box>
                </Box>
              ))}
            </SimpleGrid>
          </VStack>
        )}
      </VStack>
    </Box>
  );
}
