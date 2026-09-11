import { Box, Heading, Text, SimpleGrid, VStack, Icon, HStack } from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import {
  FiFileText,
  FiImage,
  FiFilePlus,
  FiDroplet,
  FiLayers,
  FiScissors,
  FiEdit3,
} from 'react-icons/fi';

const tools = [
  {
    title: 'PDF to Word',
    description: 'Convert PDF documents to editable Word files',
    icon: FiFileText,
    path: '/pdf-to-word',
    color: 'blue',
  },
  {
    title: 'PDF to JPG',
    description: 'Convert PDF pages to high-quality JPG images',
    icon: FiImage,
    path: '/pdf-to-jpg',
    color: 'green',
  },
  {
    title: 'Word to PDF',
    description: 'Convert Word documents to PDF format',
    icon: FiFilePlus,
    path: '/word-to-pdf',
    color: 'purple',
  },
  {
    title: 'PDF Watermark',
    description: 'Add custom text watermarks to your PDFs',
    icon: FiDroplet,
    path: '/pdf-watermark',
    color: 'orange',
  },
  {
    title: 'PDF Merge',
    description: 'Combine multiple PDF files into one document',
    icon: FiLayers,
    path: '/pdf-merge',
    color: 'teal',
  },
  {
    title: 'PDF Split',
    description: 'Split a PDF into separate documents by page range',
    icon: FiScissors,
    path: '/pdf-split',
    color: 'red',
  },
  {
    title: 'PDF Sign',
    description: 'Draw or upload a signature and place it on your PDF',
    icon: FiEdit3,
    path: '/pdf-sign',
    color: 'cyan',
  },
];

export function Home() {
  return (
    <Box maxW="1000px" mx="auto" py={12} px={6}>
      <VStack gap={3} mb={12} textAlign="center">
        <Heading as="h1" size="3xl" color="gray.800">
          PDF Toolkit
        </Heading>
        <Text color="gray.500" fontSize="lg" maxW="600px">
          Free online PDF tools. Convert, merge, split, watermark, and sign PDFs.
          100% client-side — your files never leave your browser.
        </Text>
      </VStack>

      <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} gap={6}>
        {tools.map((tool) => (
          <Link key={tool.path} to={tool.path}>
            <Box
              id={`tool-card-${tool.path.slice(1)}`}
              p={6}
              bg="white"
              borderRadius="xl"
              border="1px solid"
              borderColor="gray.200"
              transition="all 0.2s"
              _hover={{
                transform: 'translateY(-2px)',
                shadow: 'lg',
                borderColor: `${tool.color}.300`,
              }}
              cursor="pointer"
              h="full"
            >
              <VStack align="start" gap={3}>
                <HStack gap={3}>
                  <Box
                    p={2}
                    bg={`${tool.color}.50`}
                    borderRadius="lg"
                    color={`${tool.color}.500`}
                  >
                    <Icon fontSize="xl">
                      <tool.icon />
                    </Icon>
                  </Box>
                  <Heading as="h2" size="md" color="gray.800">
                    {tool.title}
                  </Heading>
                </HStack>
                <Text color="gray.500" fontSize="sm">
                  {tool.description}
                </Text>
              </VStack>
            </Box>
          </Link>
        ))}
      </SimpleGrid>

      <Box mt={16} textAlign="center">
        <Text color="gray.400" fontSize="xs">
          🔒 Your files are processed entirely in your browser. Nothing is uploaded to any server.
        </Text>
      </Box>
    </Box>
  );
}
