import { useState, useEffect } from 'react';
import { Box, Flex, Text, Icon, Spinner } from '@chakra-ui/react';
import { FiMessageCircle, FiMail, FiCheckCircle, FiXCircle, FiRefreshCw } from 'react-icons/fi';
import { getSettings, testWhatsApp } from '../services/api';
import type { SettingsResponse } from '../types';

export function SettingsPage() {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await getSettings();
      setSettings(data);
    } catch {
      // Settings might not be available yet
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestWhatsApp = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testWhatsApp();
      setTestResult({
        success: result.success,
        message: result.success
          ? `Connected! Phone: ${result.phoneNumber}`
          : result.error || 'Connection failed',
      });
    } catch {
      setTestResult({ success: false, message: 'Connection test failed' });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <Flex justify="center" align="center" minH="60vh">
        <Spinner size="lg" color="#25D366" />
      </Flex>
    );
  }

  return (
    <Box maxW="800px">
      {/* Header */}
      <Box mb={8}>
        <Text fontSize="2xl" fontWeight="800" color="white" mb={1}>
          Settings
        </Text>
        <Text fontSize="sm" color="#6b7280">
          Configure your WhatsApp API and email settings
        </Text>
      </Box>

      {/* WhatsApp Configuration */}
      <Box
        bg="#111827"
        border="1px solid"
        borderColor="#1f2937"
        borderRadius="20px"
        p={6}
        mb={6}
      >
        <Flex align="center" gap={3} mb={5}>
          <Flex
            align="center"
            justify="center"
            w="42px"
            h="42px"
            borderRadius="12px"
            bg="linear-gradient(135deg, #25D366, #128C7E)"
          >
            <Icon as={FiMessageCircle} color="white" boxSize={5} />
          </Flex>
          <Box>
            <Text fontSize="md" fontWeight="700" color="white">
              WhatsApp Business API
            </Text>
            <Text fontSize="xs" color="#6b7280">
              Meta Cloud API configuration
            </Text>
          </Box>
          <Box ml="auto">
            <Flex
              align="center"
              gap={1.5}
              px={3}
              py={1.5}
              borderRadius="full"
              bg={
                settings?.whatsapp.configured
                  ? 'rgba(37,211,102,0.1)'
                  : 'rgba(244,63,94,0.1)'
              }
            >
              <Icon
                as={settings?.whatsapp.configured ? FiCheckCircle : FiXCircle}
                color={settings?.whatsapp.configured ? '#25D366' : '#f43f5e'}
                boxSize={3.5}
              />
              <Text
                fontSize="xs"
                fontWeight="600"
                color={settings?.whatsapp.configured ? '#25D366' : '#f43f5e'}
              >
                {settings?.whatsapp.configured ? 'Connected' : 'Not Configured'}
              </Text>
            </Flex>
          </Box>
        </Flex>

        <Flex direction="column" gap={3} mb={5}>
          {[
            { label: 'API Version', value: settings?.whatsapp.apiVersion || '—' },
            { label: 'Phone Number ID', value: settings?.whatsapp.phoneNumberId || 'Not set' },
            {
              label: 'Webhook Verify Token',
              value: settings?.whatsapp.webhookVerifyToken || 'Not set',
            },
          ].map((item) => (
            <Flex
              key={item.label}
              justify="space-between"
              align="center"
              py={2}
              borderBottom="1px solid"
              borderColor="#1f2937"
            >
              <Text fontSize="sm" color="#6b7280">
                {item.label}
              </Text>
              <Text fontSize="sm" color="white" fontWeight="500" fontFamily="mono">
                {item.value}
              </Text>
            </Flex>
          ))}
        </Flex>

        {/* Test button */}
        <Box
          as="button"
          display="flex"
          alignItems="center"
          justifyContent="center"
          gap={2}
          w="full"
          py={3}
          borderRadius="12px"
          border="1px solid"
          borderColor="#374151"
          bg="#0a0e17"
          color="white"
          fontSize="sm"
          fontWeight="600"
          transition="all 0.2s"
          cursor={isTesting ? 'wait' : 'pointer'}
          _hover={{ borderColor: '#6b7280' }}
          onClick={handleTestWhatsApp}
        >
          <Icon as={FiRefreshCw} boxSize={4} className={isTesting ? 'spin' : ''} />
          {isTesting ? 'Testing...' : 'Test Connection'}
        </Box>

        {testResult && (
          <Box
            mt={3}
            p={3}
            borderRadius="10px"
            bg={testResult.success ? 'rgba(37,211,102,0.08)' : 'rgba(244,63,94,0.08)'}
            border="1px solid"
            borderColor={
              testResult.success ? 'rgba(37,211,102,0.2)' : 'rgba(244,63,94,0.2)'
            }
          >
            <Text
              fontSize="sm"
              color={testResult.success ? '#25D366' : '#f43f5e'}
              fontWeight="600"
            >
              {testResult.message}
            </Text>
          </Box>
        )}

        <Box mt={4} p={3} bg="#0a0e17" borderRadius="10px">
          <Text fontSize="xs" color="#6b7280">
            💡 Configure your credentials in the server's <code>.env</code> file.
            Set <code>META_WA_PHONE_NUMBER_ID</code> and <code>META_WA_ACCESS_TOKEN</code>.
          </Text>
        </Box>
      </Box>

      {/* Email Configuration */}
      <Box
        bg="#111827"
        border="1px solid"
        borderColor="#1f2937"
        borderRadius="20px"
        p={6}
        mb={6}
      >
        <Flex align="center" gap={3} mb={5}>
          <Flex
            align="center"
            justify="center"
            w="42px"
            h="42px"
            borderRadius="12px"
            bg="linear-gradient(135deg, #3b82f6, #6366f1)"
          >
            <Icon as={FiMail} color="white" boxSize={5} />
          </Flex>
          <Box>
            <Text fontSize="md" fontWeight="700" color="white">
              Email Notifications
            </Text>
            <Text fontSize="xs" color="#6b7280">
              SMTP configuration for transactional emails
            </Text>
          </Box>
          <Box ml="auto">
            <Flex
              align="center"
              gap={1.5}
              px={3}
              py={1.5}
              borderRadius="full"
              bg={
                settings?.email.configured
                  ? 'rgba(37,211,102,0.1)'
                  : 'rgba(244,63,94,0.1)'
              }
            >
              <Icon
                as={settings?.email.configured ? FiCheckCircle : FiXCircle}
                color={settings?.email.configured ? '#25D366' : '#f43f5e'}
                boxSize={3.5}
              />
              <Text
                fontSize="xs"
                fontWeight="600"
                color={settings?.email.configured ? '#25D366' : '#f43f5e'}
              >
                {settings?.email.configured ? 'Configured' : 'Not Configured'}
              </Text>
            </Flex>
          </Box>
        </Flex>

        <Flex direction="column" gap={3}>
          {[
            { label: 'SMTP Host', value: settings?.email.smtpHost || '—' },
            { label: 'From Address', value: settings?.email.from || '—' },
          ].map((item) => (
            <Flex
              key={item.label}
              justify="space-between"
              align="center"
              py={2}
              borderBottom="1px solid"
              borderColor="#1f2937"
            >
              <Text fontSize="sm" color="#6b7280">
                {item.label}
              </Text>
              <Text fontSize="sm" color="white" fontWeight="500" fontFamily="mono">
                {item.value}
              </Text>
            </Flex>
          ))}
        </Flex>
      </Box>

      {/* Limits */}
      <Box
        bg="#111827"
        border="1px solid"
        borderColor="#1f2937"
        borderRadius="20px"
        p={6}
      >
        <Text fontSize="md" fontWeight="700" color="white" mb={4}>
          Limits & Defaults
        </Text>
        <Flex direction="column" gap={3}>
          {[
            {
              label: 'Max Recipients per Campaign',
              value: settings?.limits.maxRecipientsPerCampaign || '—',
            },
            {
              label: 'Max Upload Size',
              value: settings?.limits.maxUploadSizeMB
                ? `${settings.limits.maxUploadSizeMB} MB`
                : '—',
            },
            {
              label: 'Default Timezone',
              value: settings?.limits.defaultTimezone || '—',
            },
          ].map((item) => (
            <Flex
              key={item.label}
              justify="space-between"
              align="center"
              py={2}
              borderBottom="1px solid"
              borderColor="#1f2937"
            >
              <Text fontSize="sm" color="#6b7280">
                {item.label}
              </Text>
              <Text fontSize="sm" color="white" fontWeight="500">
                {String(item.value)}
              </Text>
            </Flex>
          ))}
        </Flex>
      </Box>
    </Box>
  );
}
