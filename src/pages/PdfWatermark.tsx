import { useState } from 'react';
import {
  Box,
  Heading,
  Text,
  VStack,
  Button,
  Input,
  HStack,
  Fieldset,
} from '@chakra-ui/react';
import { saveAs } from 'file-saver';
import { FileDropzone } from '../components/FileDropzone';
import { addWatermark, type WatermarkOptions } from '../utils/pdfWatermark';

export function PdfWatermark() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [options, setOptions] = useState<WatermarkOptions>({
    text: 'CONFIDENTIAL',
    fontSize: 60,
    opacity: 0.3,
    rotation: -45,
    color: { r: 0.5, g: 0.5, b: 0.5 },
  });

  const handleFiles = (files: File[]) => {
    setFile(files[0]);
    setError(null);
    setDone(false);
  };

  const handleApply = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const blob = await addWatermark(file, options);
      const name = file.name.replace(/\.pdf$/i, '') + '_watermarked.pdf';
      saveAs(blob, name);
      setDone(true);
    } catch (err) {
      console.error(err);
      setError('Failed to add watermark. Please try a different file.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box maxW="700px" mx="auto" py={10} px={6}>
      <VStack gap={6} align="stretch">
        <Box>
          <Heading as="h1" size="xl" color="gray.800" mb={2}>
            PDF Watermark
          </Heading>
          <Text color="gray.500">
            Add a custom text watermark to every page of your PDF.
          </Text>
        </Box>

        <FileDropzone
          accept=".pdf"
          onFilesSelected={handleFiles}
          label="Drop your PDF file here"
        />

        {file && (
          <Box p={4} bg="gray.50" borderRadius="lg">
            <Text fontWeight="medium" color="gray.700">📄 {file.name}</Text>
          </Box>
        )}

        <Fieldset.Root>
          <Fieldset.Legend fontWeight="bold" color="gray.700" mb={3}>
            Watermark Options
          </Fieldset.Legend>
          <VStack gap={4} align="stretch">
            <Box>
              <Text fontSize="sm" fontWeight="medium" color="gray.600" mb={1}>
                Watermark Text
              </Text>
              <Input
                id="watermark-text"
                value={options.text}
                onChange={(e) =>
                  setOptions({ ...options, text: e.target.value })
                }
                placeholder="e.g., CONFIDENTIAL"
              />
            </Box>
            <HStack gap={4}>
              <Box flex={1}>
                <Text fontSize="sm" fontWeight="medium" color="gray.600" mb={1}>
                  Font Size
                </Text>
                <Input
                  id="watermark-fontsize"
                  type="number"
                  value={options.fontSize}
                  onChange={(e) =>
                    setOptions({ ...options, fontSize: Number(e.target.value) })
                  }
                />
              </Box>
              <Box flex={1}>
                <Text fontSize="sm" fontWeight="medium" color="gray.600" mb={1}>
                  Opacity (0-1)
                </Text>
                <Input
                  id="watermark-opacity"
                  type="number"
                  step={0.1}
                  min={0}
                  max={1}
                  value={options.opacity}
                  onChange={(e) =>
                    setOptions({ ...options, opacity: Number(e.target.value) })
                  }
                />
              </Box>
              <Box flex={1}>
                <Text fontSize="sm" fontWeight="medium" color="gray.600" mb={1}>
                  Rotation (°)
                </Text>
                <Input
                  id="watermark-rotation"
                  type="number"
                  value={options.rotation}
                  onChange={(e) =>
                    setOptions({ ...options, rotation: Number(e.target.value) })
                  }
                />
              </Box>
            </HStack>
          </VStack>
        </Fieldset.Root>

        {error && (
          <Box p={4} bg="red.50" borderRadius="lg">
            <Text color="red.600">{error}</Text>
          </Box>
        )}

        {done && (
          <Box p={4} bg="green.50" borderRadius="lg">
            <Text color="green.600">✅ Watermark added! Your file has been downloaded.</Text>
          </Box>
        )}

        <Button
          colorPalette="orange"
          size="lg"
          onClick={handleApply}
          disabled={!file || loading || !options.text.trim()}
          loading={loading}
          loadingText="Applying..."
          w="full"
        >
          Add Watermark & Download
        </Button>
      </VStack>
    </Box>
  );
}
