import {
  Box,
  Text,
  Stack,
  Grid,
  Button,
  Heading,
  Flex,
} from '@chakra-ui/react'

interface QuickAction {
  title: string
  description: string
  icon: string
  color: string
  bgColor: string
  textColor: string
}

export function QuickActions() {
  const actions: QuickAction[] = [
    {
      title: 'Add Expense',
      description: 'Record a new expense',
      icon: '➖',
      color: 'red.500',
      bgColor: 'red.50',
      textColor: 'red.600'
    },
    {
      title: 'Add Income',
      description: 'Record incoming money',
      icon: '➕',
      color: 'green.500',
      bgColor: 'green.50',
      textColor: 'green.600'
    },
    {
      title: 'Set Budget',
      description: 'Update monthly budget',
      icon: '💰',
      color: 'blue.500',
      bgColor: 'blue.50',
      textColor: 'blue.600'
    },
    {
      title: 'View Reports',
      description: 'Detailed spending analysis',
      icon: '📊',
      color: 'purple.500',
      bgColor: 'purple.50',
      textColor: 'purple.600'
    },
    {
      title: 'Export Data',
      description: 'Download your data',
      icon: '📥',
      color: 'orange.500',
      bgColor: 'orange.50',
      textColor: 'orange.600'
    },
    {
      title: 'Settings',
      description: 'App preferences',
      icon: '⚙️',
      color: 'gray.500',
      bgColor: 'gray.50',
      textColor: 'gray.600'
    }
  ]

  return (
    <Box
      bg="white"
      borderRadius="2xl"
      p={6}
      shadow="xs"
    >
      <Heading size="lg" fontWeight="semibold" mb={4} color="gray.900">
        Quick Actions
      </Heading>
      
      <Grid templateColumns="repeat(2, 1fr)" gap={3}>
        {actions.map((action, index) => (
          <Button
            key={index}
            p={4}
            h="auto"
            bg={action.bgColor}
            borderRadius="xl"
            textAlign="left"
            justifyContent="flex-start"
            flexDirection="column"
            alignItems="flex-start"
            border="1px solid transparent"
            _hover={{
              shadow: 'md',
              borderColor: 'gray.200',
              transform: 'translateY(-1px)'
            }}
            transition="all 0.2s"
          >
            <Box
              w={10}
              h={10}
              bg={action.color}
              borderRadius="full"
              display="flex"
              alignItems="center"
              justifyContent="center"
              mb={3}
              color="white"
            >
              <Text fontSize="lg">{action.icon}</Text>
            </Box>
            <Heading size="sm" fontWeight="semibold" color={action.textColor} mb={1}>
              {action.title}
            </Heading>
            <Text fontSize="xs" color="gray.500">
              {action.description}
            </Text>
          </Button>
        ))}
      </Grid>

      {/* Recent Activity */}
      <Box mt={6} pt={6} borderTopWidth="1px" borderTopColor="gray.100">
        <Heading size="sm" fontWeight="medium" mb={3} color="gray.900">
          Recent Activity
        </Heading>
        <Stack gap={2}>
          <Flex align="center" justify="space-between" py={2}>
            <Flex align="center" gap={2}>
              <Box w={2} h={2} bg="red.500" borderRadius="full" />
              <Text fontSize="xs" color="gray.600">
                Added expense
              </Text>
            </Flex>
            <Text fontSize="xs" color="gray.400">
              2 hours ago
            </Text>
          </Flex>
          <Flex align="center" justify="space-between" py={2}>
            <Flex align="center" gap={2}>
              <Box w={2} h={2} bg="green.500" borderRadius="full" />
              <Text fontSize="xs" color="gray.600">
                Income received
              </Text>
            </Flex>
            <Text fontSize="xs" color="gray.400">
              1 day ago
            </Text>
          </Flex>
          <Flex align="center" justify="space-between" py={2}>
            <Flex align="center" gap={2}>
              <Box w={2} h={2} bg="blue.500" borderRadius="full" />
              <Text fontSize="xs" color="gray.600">
                Budget updated
              </Text>
            </Flex>
            <Text fontSize="xs" color="gray.400">
              3 days ago
            </Text>
          </Flex>
        </Stack>
      </Box>
    </Box>
  )
}
