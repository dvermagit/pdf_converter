import { Box, Flex, Text, HStack } from '@chakra-ui/react';
import { Link, useLocation } from 'react-router-dom';
import { FiFileText } from 'react-icons/fi';

export function Navbar() {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <Box
      as="nav"
      bg="white"
      borderBottom="1px solid"
      borderColor="gray.200"
      px={6}
      py={3}
      position="sticky"
      top={0}
      zIndex={100}
    >
      <Flex maxW="1200px" mx="auto" align="center" justify="space-between">
        <Link to="/">
          <HStack gap={2}>
            <Box color="blue.500" fontSize="xl">
              <FiFileText />
            </Box>
            <Text fontWeight="bold" fontSize="lg" color="gray.800">
              PDF Toolkit
            </Text>
          </HStack>
        </Link>
        {!isHome && (
          <Link to="/">
            <Text
              color="blue.500"
              fontWeight="medium"
              fontSize="sm"
              _hover={{ textDecoration: 'underline' }}
            >
              ← All Tools
            </Text>
          </Link>
        )}
      </Flex>
    </Box>
  );
}
