import { useState } from 'react';
import { Box, Flex, Text, Icon, Input } from '@chakra-ui/react';
import { FiMessageCircle, FiMail, FiLock, FiUser, FiArrowRight } from 'react-icons/fi';
import { login, register } from '../services/api';
import { PlainButton } from '../components/ui/fields';

export function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
      window.location.href = '/';
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response: { data: { error: string } } }).response?.data?.error
          : 'Something went wrong';
      setError(msg || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Flex
      minH="100vh"
      align="center"
      justify="center"
      bg="#0a0e17"
      px={4}
    >
      {/* Background gradient */}
      <Box
        position="fixed"
        top="0"
        left="0"
        right="0"
        bottom="0"
        bg="radial-gradient(ellipse at 50% 0%, rgba(37,211,102,0.08) 0%, transparent 50%)"
        pointerEvents="none"
      />

      <Box
        w="full"
        maxW="420px"
        position="relative"
        zIndex="1"
      >
        {/* Logo */}
        <Flex direction="column" align="center" mb={8}>
          <Flex
            align="center"
            justify="center"
            w="56px"
            h="56px"
            borderRadius="16px"
            bg="linear-gradient(135deg, #25D366 0%, #128C7E 100%)"
            mb={4}
            boxShadow="0 8px 32px rgba(37,211,102,0.3)"
          >
            <Icon as={FiMessageCircle} color="white" boxSize={7} />
          </Flex>
          <Text fontSize="xl" fontWeight="800" color="white" mb={1}>
            WA Excel Dispatcher
          </Text>
          <Text fontSize="sm" color="#6b7280">
            {isLogin ? 'Sign in to your account' : 'Create a new account'}
          </Text>
        </Flex>

        {/* Form */}
        <Box
          as="form"
          onSubmit={handleSubmit}
          bg="#111827"
          border="1px solid"
          borderColor="#1f2937"
          borderRadius="20px"
          p={7}
        >
          {!isLogin && (
            <Box mb={4}>
              <Text fontSize="xs" color="#9ca3af" fontWeight="600" mb={2} textTransform="uppercase" letterSpacing="0.05em">
                Full Name
              </Text>
              <Flex
                align="center"
                gap={3}
                bg="#0a0e17"
                border="1px solid"
                borderColor="#374151"
                borderRadius="10px"
                px={3}
                transition="all 0.2s"
                _focusWithin={{ borderColor: '#25D366' }}
              >
                <Icon as={FiUser} color="#6b7280" boxSize={4} />
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  bg="transparent"
                  border="none"
                  color="white"
                  py={3}
                  fontSize="sm"
                  outline="none"
                  _focus={{ boxShadow: 'none' }}
                  _placeholder={{ color: '#4b5563' }}
                />
              </Flex>
            </Box>
          )}

          <Box mb={4}>
            <Text fontSize="xs" color="#9ca3af" fontWeight="600" mb={2} textTransform="uppercase" letterSpacing="0.05em">
              Email
            </Text>
            <Flex
              align="center"
              gap={3}
              bg="#0a0e17"
              border="1px solid"
              borderColor="#374151"
              borderRadius="10px"
              px={3}
              transition="all 0.2s"
              _focusWithin={{ borderColor: '#25D366' }}
            >
              <Icon as={FiMail} color="#6b7280" boxSize={4} />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                bg="transparent"
                border="none"
                color="white"
                py={3}
                fontSize="sm"
                outline="none"
                _focus={{ boxShadow: 'none' }}
                _placeholder={{ color: '#4b5563' }}
                required
              />
            </Flex>
          </Box>

          <Box mb={6}>
            <Text fontSize="xs" color="#9ca3af" fontWeight="600" mb={2} textTransform="uppercase" letterSpacing="0.05em">
              Password
            </Text>
            <Flex
              align="center"
              gap={3}
              bg="#0a0e17"
              border="1px solid"
              borderColor="#374151"
              borderRadius="10px"
              px={3}
              transition="all 0.2s"
              _focusWithin={{ borderColor: '#25D366' }}
            >
              <Icon as={FiLock} color="#6b7280" boxSize={4} />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                bg="transparent"
                border="none"
                color="white"
                py={3}
                fontSize="sm"
                outline="none"
                _focus={{ boxShadow: 'none' }}
                _placeholder={{ color: '#4b5563' }}
                required
                minLength={8}
              />
            </Flex>
          </Box>

          {error && (
            <Box
              mb={4}
              p={3}
              borderRadius="10px"
              bg="rgba(244,63,94,0.08)"
              border="1px solid rgba(244,63,94,0.2)"
            >
              <Text color="#f43f5e" fontSize="sm" fontWeight="500">
                {error}
              </Text>
            </Box>
          )}

          <PlainButton
            type="submit"
            w="full"
            display="flex"
            alignItems="center"
            justifyContent="center"
            gap={2}
            py={3}
            borderRadius="12px"
            bg="linear-gradient(135deg, #25D366, #128C7E)"
            color="white"
            fontWeight="700"
            fontSize="sm"
            cursor={isLoading ? 'wait' : 'pointer'}
            transition="all 0.3s"
            _hover={{
              transform: 'translateY(-1px)',
              boxShadow: '0 4px 20px rgba(37,211,102,0.3)',
            }}
          >
            {isLoading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
            <Icon as={FiArrowRight} boxSize={4} />
          </PlainButton>
        </Box>

        {/* Toggle */}
        <Flex justify="center" mt={5}>
          <Text fontSize="sm" color="#6b7280">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
            <Text
              as="span"
              color="#25D366"
              fontWeight="600"
              cursor="pointer"
              _hover={{ textDecoration: 'underline' }}
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
            >
              {isLogin ? 'Sign Up' : 'Sign In'}
            </Text>
          </Text>
        </Flex>
      </Box>
    </Flex>
  );
}
