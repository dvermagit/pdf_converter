import { Box, Flex, Text, VStack, Icon } from '@chakra-ui/react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FiHome,
  FiUpload,
  FiList,
  FiSettings,
  FiLogOut,
  FiMessageCircle,
  FiEdit3,
  FiGrid,
} from 'react-icons/fi';
import { logout, getStoredUser } from '../../services/api';

interface NavItem {
  label: string;
  icon: typeof FiHome;
  path: string;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: FiHome, path: '/' },
  { label: 'Add People & Send', icon: FiEdit3, path: '/campaigns/new' },
  { label: 'Upload Excel', icon: FiUpload, path: '/upload' },
  { label: 'Templates', icon: FiGrid, path: '/templates' },
  { label: 'Campaigns', icon: FiList, path: '/campaigns' },
  { label: 'Settings', icon: FiSettings, path: '/settings' },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getStoredUser();

  // The longest matching path wins, so /campaigns/new highlights its own item
  // rather than the broader /campaigns one.
  const activePath = navItems
    .filter((item) =>
      item.path === '/'
        ? location.pathname === '/'
        : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
    )
    .sort((a, b) => b.path.length - a.path.length)[0]?.path;

  return (
    <Box
      as="nav"
      position="fixed"
      left="0"
      top="0"
      bottom="0"
      w="260px"
      bg="#111827"
      borderRight="1px solid"
      borderColor="#1f2937"
      display={{ base: 'none', md: 'flex' }}
      flexDirection="column"
      zIndex="sticky"
    >
      {/* Logo */}
      <Flex
        align="center"
        gap={3}
        px={6}
        py={6}
        borderBottom="1px solid"
        borderColor="#1f2937"
      >
        <Flex
          align="center"
          justify="center"
          w="40px"
          h="40px"
          borderRadius="12px"
          bg="linear-gradient(135deg, #25D366 0%, #128C7E 100%)"
        >
          <Icon as={FiMessageCircle} color="white" boxSize={5} />
        </Flex>
        <Box>
          <Text fontSize="sm" fontWeight="bold" color="white" lineHeight="1.2">
            WA Dispatcher
          </Text>
          <Text fontSize="xs" color="gray.500">
            Excel Automation
          </Text>
        </Box>
      </Flex>

      {/* Nav Items */}
      <VStack gap={1} px={3} py={4} flex="1" align="stretch">
        {navItems.map((item) => {
          const isActive = item.path === activePath;

          return (
            <Flex
              key={item.path}
              align="center"
              gap={3}
              px={4}
              py={3}
              borderRadius="10px"
              cursor="pointer"
              transition="all 0.2s"
              bg={isActive ? 'rgba(37, 211, 102, 0.1)' : 'transparent'}
              color={isActive ? '#25D366' : '#9ca3af'}
              _hover={{
                bg: isActive ? 'rgba(37, 211, 102, 0.15)' : 'rgba(255,255,255,0.05)',
                color: isActive ? '#25D366' : 'white',
              }}
              onClick={() => navigate(item.path)}
              role="button"
              tabIndex={0}
            >
              <Icon as={item.icon} boxSize={5} />
              <Text fontSize="sm" fontWeight={isActive ? '600' : '400'}>
                {item.label}
              </Text>
              {isActive && (
                <Box
                  position="absolute"
                  left="0"
                  w="3px"
                  h="24px"
                  borderRadius="0 4px 4px 0"
                  bg="#25D366"
                />
              )}
            </Flex>
          );
        })}
      </VStack>

      {/* User section */}
      <Box px={3} py={4} borderTop="1px solid" borderColor="#1f2937">
        <Flex
          align="center"
          gap={3}
          px={4}
          py={3}
          borderRadius="10px"
          mb={2}
        >
          <Flex
            align="center"
            justify="center"
            w="36px"
            h="36px"
            borderRadius="10px"
            bg="linear-gradient(135deg, #a855f7, #3b82f6)"
            flexShrink={0}
          >
            <Text fontSize="sm" fontWeight="bold" color="white">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </Flex>
          <Box flex="1" overflow="hidden">
            <Text fontSize="sm" fontWeight="600" color="white" truncate>
              {user?.name || 'User'}
            </Text>
            <Text fontSize="xs" color="gray.500" truncate>
              {user?.email || ''}
            </Text>
          </Box>
        </Flex>
        <Flex
          align="center"
          gap={3}
          px={4}
          py={2.5}
          borderRadius="10px"
          cursor="pointer"
          color="#9ca3af"
          transition="all 0.2s"
          _hover={{ bg: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e' }}
          onClick={logout}
          role="button"
        >
          <Icon as={FiLogOut} boxSize={4} />
          <Text fontSize="sm">Sign Out</Text>
        </Flex>
      </Box>
    </Box>
  );
}
