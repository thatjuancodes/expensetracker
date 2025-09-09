import {
  Box,
  Text,
  Stack,
  Flex,
  Button,
  Heading,
} from '@chakra-ui/react'

interface IncomeItem {
  id: string
  source: string
  amount: number
  expectedDate: Date
  status: 'pending' | 'received'
}

interface IncomeListProps {
  income: IncomeItem[]
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'received':
      return 'green'
    case 'pending':
      return 'yellow'
    case 'overdue':
      return 'red'
    default:
      return 'gray'
  }
}

const getDaysUntil = (date: Date) => {
  const today = new Date()
  const timeDiff = date.getTime() - today.getTime()
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24))
  
  if (daysDiff === 0) return 'Today'
  if (daysDiff === 1) return 'Tomorrow'
  if (daysDiff > 0) return `In ${daysDiff} days`
  return `${Math.abs(daysDiff)} days ago`
}

export function IncomeList({ income }: IncomeListProps) {
  const getSourceIcon = (source: string) => {
    if (source.toLowerCase().includes('salary')) return '💼'
    if (source.toLowerCase().includes('freelance')) return '💻'
    if (source.toLowerCase().includes('investment')) return '📈'
    if (source.toLowerCase().includes('dividend')) return '💰'
    return '💳'
  }

  return (
    <Box
      bg="white"
      borderRadius="2xl"
      p={4}
      shadow="xs"
    >
      <Flex align="center" justify="space-between" mb={4}>
        <Heading size="sm" fontWeight="semibold" color="gray.900">
          Expected Income ({income.length})
        </Heading>
        <Button
          size="xs"
          variant="ghost"
          color="blue.500"
          fontWeight="medium"
          _hover={{ bg: 'blue.50' }}
          borderRadius="full"
          px={3}
        >
          View All
        </Button>
      </Flex>

      <Stack gap={3}>
        {income.map((item) => (
          <Box
            key={item.id}
            p={3}
            borderRadius="lg"
            border="1px solid"
            borderColor="gray.100"
            bg="gray.50"
            _hover={{ bg: 'gray.100', borderColor: 'gray.200' }}
            transition="all 0.2s"
          >
            <Flex align="center" justify="space-between">
              <Flex align="center" gap={3}>
                <Box
                  w={10}
                  h={10}
                  bg="green.50"
                  borderRadius="full"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  fontSize="lg"
                >
                  {getSourceIcon(item.source)}
                </Box>
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" color="gray.900">
                    {item.source}
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    Expected: {item.expectedDate.toLocaleDateString()} • {getDaysUntil(item.expectedDate)}
                  </Text>
                </Box>
              </Flex>
              
              <Flex align="center" gap={3}>
                <Box textAlign="right">
                  <Text fontSize="sm" fontWeight="bold" color="green.600">
                    +${item.amount.toLocaleString()}
                  </Text>
                  <Box
                    px={2}
                    py={1}
                    borderRadius="full"
                    fontSize="xs"
                    fontWeight="medium"
                    bg={`${getStatusColor(item.status)}.100`}
                    color={`${getStatusColor(item.status)}.700`}
                  >
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </Box>
                </Box>
              </Flex>
            </Flex>
          </Box>
        ))}
      </Stack>

      {/* Summary */}
      <Box mt={4} pt={4} borderTopWidth="1px" borderTopColor="gray.100">
        <Flex justify="space-between" align="center">
          <Box>
            <Text fontSize="xs" color="gray.500">Total Expected</Text>
            <Text fontSize="lg" fontWeight="bold" color="green.600">
              ${income.reduce((sum, item) => sum + item.amount, 0).toLocaleString()}
            </Text>
          </Box>
          <Box textAlign="right">
            <Text fontSize="xs" color="gray.500">Pending Items</Text>
            <Text fontSize="lg" fontWeight="bold" color="gray.900">
              {income.filter(item => item.status === 'pending').length}
            </Text>
          </Box>
        </Flex>
      </Box>
    </Box>
  )
}
