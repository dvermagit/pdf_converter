import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  Heading,
  Text,
  VStack,
  Button,
  HStack,
  Input,
} from '@chakra-ui/react';
import { saveAs } from 'file-saver';
import SignaturePad from 'signature_pad';
import * as pdfjsLib from 'pdfjs-dist';
import { FileDropzone } from '../components/FileDropzone';
import { addSignature } from '../utils/pdfSign';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

export function PdfSign() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [sigPosition, setSigPosition] = useState({ x: 50, y: 600 });
  const [sigSize, setSigSize] = useState({ width: 200, height: 80 });

  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const sigPadRef = useRef<SignaturePad | null>(null);

  // Initialize signature pad
  useEffect(() => {
    if (sigCanvasRef.current && !sigPadRef.current) {
      sigPadRef.current = new SignaturePad(sigCanvasRef.current, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(0, 0, 0)',
      });
    }
  }, []);

  // Render PDF preview
  const renderPreview = useCallback(async (f: File, pageNum: number) => {
    try {
      const arrayBuffer = await f.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      setPageCount(pdf.numPages);
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.0 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
      setPreviewUrl(canvas.toDataURL('image/png'));
    } catch {
      setError('Could not preview PDF.');
    }
  }, []);

  const handleFiles = async (files: File[]) => {
    const f = files[0];
    setFile(f);
    setError(null);
    setDone(false);
    setCurrentPage(1);
    await renderPreview(f, 1);
  };

  const handlePageChange = async (page: number) => {
    if (!file || page < 1 || page > pageCount) return;
    setCurrentPage(page);
    await renderPreview(file, page);
  };

  const clearSignature = () => {
    sigPadRef.current?.clear();
    setSignatureDataUrl(null);
  };

  const saveSignature = () => {
    if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
      setError('Please draw a signature first.');
      return;
    }
    const dataUrl = sigPadRef.current.toDataURL('image/png');
    setSignatureDataUrl(dataUrl);
  };

  const handleSign = async () => {
    if (!file || !signatureDataUrl) return;
    setLoading(true);
    setError(null);
    try {
      const blob = await addSignature(file, signatureDataUrl, {
        x: sigPosition.x,
        y: sigPosition.y,
        width: sigSize.width,
        height: sigSize.height,
        pageIndex: currentPage - 1,
      });
      const name = file.name.replace(/\.pdf$/i, '') + '_signed.pdf';
      saveAs(blob, name);
      setDone(true);
    } catch (err) {
      console.error(err);
      setError('Failed to sign PDF. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box maxW="800px" mx="auto" py={10} px={6}>
      <VStack gap={6} align="stretch">
        <Box>
          <Heading as="h1" size="xl" color="gray.800" mb={2}>
            PDF Sign
          </Heading>
          <Text color="gray.500">
            Draw your signature and place it on a PDF page.
          </Text>
        </Box>

        <FileDropzone
          accept=".pdf"
          onFilesSelected={handleFiles}
          label="Drop your PDF file here"
        />

        {file && previewUrl && (
          <VStack gap={4} align="stretch">
            <HStack justify="space-between">
              <Text fontWeight="medium" color="gray.700">
                📄 {file.name}
              </Text>
              <HStack gap={2}>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                >
                  ← Prev
                </Button>
                <Text fontSize="sm" color="gray.500">
                  Page {currentPage} / {pageCount}
                </Text>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= pageCount}
                >
                  Next →
                </Button>
              </HStack>
            </HStack>
            <Box
              border="1px solid"
              borderColor="gray.200"
              borderRadius="lg"
              overflow="hidden"
              position="relative"
            >
              <img
                src={previewUrl}
                alt={`Page ${currentPage}`}
                style={{ width: '100%', display: 'block' }}
              />
              {signatureDataUrl && (
                <Box
                  position="absolute"
                  border="2px dashed"
                  borderColor="blue.400"
                  bg="rgba(255,255,255,0.7)"
                  style={{
                    left: `${(sigPosition.x / 612) * 100}%`,
                    top: `${(sigPosition.y / 792) * 100}%`,
                    width: `${(sigSize.width / 612) * 100}%`,
                    height: `${(sigSize.height / 792) * 100}%`,
                  }}
                >
                  <img
                    src={signatureDataUrl}
                    alt="Signature"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </Box>
              )}
            </Box>
          </VStack>
        )}

        {/* Signature pad */}
        <Box>
          <Text fontWeight="bold" color="gray.700" mb={2}>
            Draw Your Signature
          </Text>
          <Box
            border="1px solid"
            borderColor="gray.300"
            borderRadius="lg"
            overflow="hidden"
          >
            <canvas
              ref={sigCanvasRef}
              width={600}
              height={200}
              style={{ width: '100%', height: '200px', cursor: 'crosshair' }}
            />
          </Box>
          <HStack mt={2} gap={2}>
            <Button size="sm" variant="outline" onClick={clearSignature}>
              Clear
            </Button>
            <Button size="sm" colorPalette="blue" onClick={saveSignature}>
              Save Signature
            </Button>
          </HStack>
        </Box>

        {/* Position controls */}
        {signatureDataUrl && (
          <Box>
            <Text fontWeight="bold" color="gray.700" mb={2}>
              Signature Position (PDF coordinates)
            </Text>
            <HStack gap={4} flexWrap="wrap">
              <Box>
                <Text fontSize="xs" color="gray.500">X</Text>
                <Input
                  id="sig-pos-x"
                  type="number"
                  size="sm"
                  w="80px"
                  value={sigPosition.x}
                  onChange={(e) =>
                    setSigPosition((p) => ({ ...p, x: Number(e.target.value) }))
                  }
                />
              </Box>
              <Box>
                <Text fontSize="xs" color="gray.500">Y</Text>
                <Input
                  id="sig-pos-y"
                  type="number"
                  size="sm"
                  w="80px"
                  value={sigPosition.y}
                  onChange={(e) =>
                    setSigPosition((p) => ({ ...p, y: Number(e.target.value) }))
                  }
                />
              </Box>
              <Box>
                <Text fontSize="xs" color="gray.500">Width</Text>
                <Input
                  id="sig-size-w"
                  type="number"
                  size="sm"
                  w="80px"
                  value={sigSize.width}
                  onChange={(e) =>
                    setSigSize((s) => ({ ...s, width: Number(e.target.value) }))
                  }
                />
              </Box>
              <Box>
                <Text fontSize="xs" color="gray.500">Height</Text>
                <Input
                  id="sig-size-h"
                  type="number"
                  size="sm"
                  w="80px"
                  value={sigSize.height}
                  onChange={(e) =>
                    setSigSize((s) => ({ ...s, height: Number(e.target.value) }))
                  }
                />
              </Box>
            </HStack>
          </Box>
        )}

        {error && (
          <Box p={4} bg="red.50" borderRadius="lg">
            <Text color="red.600">{error}</Text>
          </Box>
        )}

        {done && (
          <Box p={4} bg="green.50" borderRadius="lg">
            <Text color="green.600">✅ PDF signed! Your file has been downloaded.</Text>
          </Box>
        )}

        <Button
          colorPalette="cyan"
          size="lg"
          onClick={handleSign}
          disabled={!file || !signatureDataUrl || loading}
          loading={loading}
          loadingText="Signing..."
          w="full"
        >
          Sign PDF & Download
        </Button>
      </VStack>
    </Box>
  );
}
