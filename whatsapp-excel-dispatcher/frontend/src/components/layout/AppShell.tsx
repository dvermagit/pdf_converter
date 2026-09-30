import { Box, Flex } from '@chakra-ui/react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function AppShell() {
  return (
    <Flex minH="100vh" bg="#0a0e17">
      <Sidebar />
      <Box flex="1" ml={{ base: '0', md: '260px' }} transition="margin 0.3s ease">
        <Box as="main" p={{ base: 4, md: 8 }} maxW="1400px" mx="auto">
          <Outlet />
        </Box>
      </Box>
    </Flex>
  );
}
