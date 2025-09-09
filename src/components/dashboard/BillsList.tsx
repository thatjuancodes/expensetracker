import {
  Box,
  Text,
  Stack,
  Flex,
  Button,
  Heading,
} from '@chakra-ui/react'

interface Bill {
  id: string
  name: string
  amount: number
  category: string
  datePaid: Date
  status: 'paid' | 'pending' | 'overdue'
}

interface BillsListProps {
  bills: Bill[]
}

const categoryIcons: { [key: string]: string } = {
  'Entertainment': '🎮',
  'Utilities': '⚡',
  'Food': '🍽️',
  'Transportation': '🚗',
  'Shopping': '🛍️',
  'Health': '❤️'
}


export function BillsList({ bills }: BillsListProps) {
  const getCategoryIcon = (category: string) => {
    return categoryIcons[category] || '💳'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'green'
      case 'pending': return 'yellow'
      case 'overdue': return 'red'
      default: return 'gray'
    }
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
          Recent Bills ({bills.length})
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
        {bills.map((bill) => (
          <Box
            key={bill.id}
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
                  bg="blue.50"
                  borderRadius="full"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  fontSize="lg"
                >
                  {getCategoryIcon(bill.category)}
                </Box>
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" color="gray.900">
                    {bill.name}
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    {bill.category} • {bill.datePaid.toLocaleDateString()}
                  </Text>
                </Box>
              </Flex>
              
              <Flex align="center" gap={3}>
                <Box textAlign="right">
                  <Text fontSize="sm" fontWeight="bold" color="gray.900">
                    ${bill.amount.toFixed(2)}
                  </Text>
                  <Box
                    px={2}
                    py={1}
                    borderRadius="full"
                    fontSize="xs"
                    fontWeight="medium"
                    bg={`${getStatusColor(bill.status)}.100`}
                    color={`${getStatusColor(bill.status)}.700`}
                  >
                    {bill.status.charAt(0).toUpperCase() + bill.status.slice(1)}
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
            <Text fontSize="xs" color="gray.500">Total Paid</Text>
            <Text fontSize="lg" fontWeight="bold" color="green.600">
              ${bills.reduce((sum, bill) => sum + bill.amount, 0).toFixed(2)}
            </Text>
          </Box>
          <Box textAlign="right">
            <Text fontSize="xs" color="gray.500">Bills This Month</Text>
            <Text fontSize="lg" fontWeight="bold" color="gray.900">
              {bills.length}
            </Text>
          </Box>
        </Flex>
      </Box>
    </Box>
  )
}
