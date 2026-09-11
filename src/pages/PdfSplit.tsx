import { useState } from 'react';
import {
  Box,
  Heading,
  Text,
  VStack,
  Button,
  Input,
  HStack,
  IconButton,
} from '@chakra-ui/react';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import { saveAs } from 'file-saver';
import { FileDropzone } from '../components/FileDropzone';
import { getPageCount, splitPdf, downloadSplitsAsZip } from '../utils/pdfSplit';

interface SplitRange {
  start: string;
  end: string;
}

export function PdfSplit() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [ranges, setRanges] = useState<SplitRange[]>([{ start: '1', end: '1' }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleFiles = async (files: File[]) => {
    const f = files[0];
    setFile(f);
    setError(null);
    setDone(false);
    try {
      const count = await getPageCount(f);
      setPageCount(count);
      setRanges([{ start: '1', end: String(count) }]);
    } catch {
      setError('Could not read PDF.');
    }
  };

  const addRange = () => {
    setRanges((prev) => [...prev, { start: '1', end: String(pageCount) }]);
  };

  const removeRange = (index: number) => {
    setRanges((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRange = (index: number, field: 'start' | 'end', value: string) => {
    setRanges((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  };

  const handleSplit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const parsedRanges = ranges.map((r) => ({
        start: Math.max(1, Math.min(Number(r.start), pageCount)),
        end: Math.max(1, Math.min(Number(r.end), pageCount)),
      }));

      // Validate
      for (const r of parsedRanges) {
        if (r.start > r.end) {
          throw new Error(`Invalid range: ${r.start}-${r.end}`);
        }
      }

      const blobs = await splitPdf(file, parsedRanges);
      const baseName = file.name.replace(/\.pdf$/i, '');

      if (blobs.length === 1) {
        saveAs(blobs[0], `${baseName}_pages_${parsedRanges[0].start}-${parsedRanges[0].end}.pdf`);
      } else {
        await downloadSplitsAsZip(blobs, baseName, parsedRanges);
      }
      setDone(true);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to split PDF.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box maxW="700px" mx="auto" py={10} px={6}>
      <VStack gap={6} align="stretch">
        <Box>
          <Heading as="h1" size="xl" color="gray.800" mb={2}>
            PDF Split
          </Heading>
          <Text color="gray.500">
            Split your PDF into separate documents by specifying page ranges.
          </Text>
        </Box>

        <FileDropzone
          accept=".pdf"
          onFilesSelected={handleFiles}
          label="Drop your PDF file here"
        />

        {file && pageCount > 0 && (
          <Box p={4} bg="gray.50" borderRadius="lg">
            <Text fontWeight="medium" color="gray.700">
              📄 {file.name} — {pageCount} page(s)
            </Text>
          </Box>
        )}

        {file && pageCount > 0 && (
          <VStack gap={3} align="stretch">
            <Text fontWeight="bold" color="gray.700">
              Page Ranges
            </Text>
            {ranges.map((range, index) => (
              <HStack key={index} gap={3}>
                <Text fontSize="sm" color="gray.500" minW="60px">
                  Range {index + 1}:
                </Text>
                <Input
                  id={`split-range-start-${index}`}
                  type="number"
                  min={1}
                  max={pageCount}
                  value={range.start}
                  onChange={(e) => updateRange(index, 'start', e.target.value)}
                  size="sm"
                  w="80px"
                />
                <Text color="gray.400">to</Text>
                <Input
                  id={`split-range-end-${index}`}
                  type="number"
                  min={1}
                  max={pageCount}
                  value={range.end}
                  onChange={(e) => updateRange(index, 'end', e.target.value)}
                  size="sm"
                  w="80px"
                />
                {ranges.length > 1 && (
                  <IconButton
                    aria-label="Remove range"
                    size="xs"
                    variant="ghost"
                    colorPalette="red"
                    onClick={() => removeRange(index)}
                  >
                    <FiTrash2 />
                  </IconButton>
                )}
              </HStack>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={addRange}
              w="fit-content"
            >
              <FiPlus /> Add Range
            </Button>
          </VStack>
        )}

        {error && (
          <Box p={4} bg="red.50" borderRadius="lg">
            <Text color="red.600">{error}</Text>
          </Box>
        )}

        {done && (
          <Box p={4} bg="green.50" borderRadius="lg">
            <Text color="green.600">✅ PDF split complete! Your files have been downloaded.</Text>
          </Box>
        )}

        <Button
          colorPalette="red"
          size="lg"
          onClick={handleSplit}
          disabled={!file || ranges.length === 0 || loading}
          loading={loading}
          loadingText="Splitting..."
          w="full"
        >
          Split PDF
        </Button>
      </VStack>
    </Box>
  );
}
