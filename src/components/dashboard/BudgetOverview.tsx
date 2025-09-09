import {
  Box,
  Text,
  Grid,
  Heading,
  Flex,
} from '@chakra-ui/react'

interface BudgetData {
  totalBudget: number
  spent: number
  remaining: number
  monthlyProgress: number
}

interface BudgetOverviewProps {
  data: BudgetData
}

export function BudgetOverview({ data }: BudgetOverviewProps) {
  return (
    <Box bg="white" borderRadius="2xl" p={4} shadow="lg">
      <Box textAlign="center" mb={4}>
        <Heading size="sm" fontWeight="semibold" color="gray.900" mb={3}>
          Monthly Budget Overview
        </Heading>
        
        <Box bg="green.500" borderRadius="xl" p={4} mb={3}>
          <Box color="white">
            <Text fontSize="xs" fontWeight="medium" mb={1}>
              Remaining Budget
            </Text>
            <Heading size="xl" fontWeight="bold" mb={1}>
              ${data.remaining.toLocaleString()}
            </Heading>
            <Flex align="center" justify="center" gap={1}>
              <Text fontSize="sm">💰</Text>
              <Text fontSize="xs">Available to spend</Text>
            </Flex>
          </Box>
        </Box>

        <Box bg="red.500" borderRadius="xl" p={4}>
          <Box color="white">
            <Text fontSize="xs" fontWeight="medium" mb={1}>
              Amount Spent
            </Text>
            <Heading size="xl" fontWeight="bold" mb={1}>
              ${data.spent.toLocaleString()}
            </Heading>
            <Flex align="center" justify="center" gap={1}>
              <Text fontSize="sm">📈</Text>
              <Text fontSize="xs">
                {data.monthlyProgress}% of budget used
              </Text>
            </Flex>
          </Box>
        </Box>
      </Box>

      <Box mb={4}>
        <Flex justify="space-between" fontSize="xs" fontWeight="medium" mb={2} color="gray.700">
          <Text>Budget Progress</Text>
          <Text>{data.monthlyProgress}% Used</Text>
        </Flex>
        <Box bg="gray.200" borderRadius="full" h="3" overflow="hidden">
          <Box 
            bg="green.500"
            h="3"
            w={`${data.monthlyProgress}%`}
            borderRadius="full"
          />
        </Box>
        <Flex justify="space-between" fontSize="xs" mt={1} color="gray.500">
          <Text>$0</Text>
          <Text>${data.totalBudget.toLocaleString()}</Text>
        </Flex>
      </Box>

      <Grid templateColumns="repeat(3, 1fr)" gap={2}>
        <Box textAlign="center" p={3} bg="blue.50" borderRadius="lg">
          <Box
            w={6}
            h={6}
            bg="blue.500"
            borderRadius="full"
            display="flex"
            alignItems="center"
            justifyContent="center"
            mx="auto"
            mb={1}
          >
            <Text fontSize="xs" color="white">💰</Text>
          </Box>
          <Text fontSize="sm" fontWeight="bold" color="blue.600">
            ${data.totalBudget.toLocaleString()}
          </Text>
          <Text fontSize="xs" color="blue.500" fontWeight="medium">
            Total Budget
          </Text>
        </Box>
        
        <Box textAlign="center" p={3} bg="red.50" borderRadius="lg">
          <Box
            w={6}
            h={6}
            bg="red.500"
            borderRadius="full"
            display="flex"
            alignItems="center"
            justifyContent="center"
            mx="auto"
            mb={1}
          >
            <Text fontSize="xs" color="white">➖</Text>
          </Box>
          <Text fontSize="sm" fontWeight="bold" color="red.600">
            ${data.spent.toLocaleString()}
          </Text>
          <Text fontSize="xs" color="red.500" fontWeight="medium">
            Spent
          </Text>
        </Box>

        <Box textAlign="center" p={3} bg="green.50" borderRadius="lg">
          <Box
            w={6}
            h={6}
            bg="green.500"
            borderRadius="full"
            display="flex"
            alignItems="center"
            justifyContent="center"
            mx="auto"
            mb={1}
          >
            <Text fontSize="xs" color="white">➕</Text>
          </Box>
          <Text fontSize="sm" fontWeight="bold" color="green.600">
            ${data.remaining.toLocaleString()}
          </Text>
          <Text fontSize="xs" color="green.500" fontWeight="medium">
            Remaining
          </Text>
        </Box>
      </Grid>
    </Box>
  )
}
