import {
  Box,
  Text,
  Stack,
  Flex,
  Button,
  Heading,
} from '@chakra-ui/react'
// import { useTheme } from 'next-themes' // Temporarily removed


interface Category {
  name: string
  amount: number
  color: string
  percentage: number
}

export function ExpenseStats() {
  const categories: Category[] = [
    { name: 'Food', amount: 456, color: 'blue.500', percentage: 21 },
    { name: 'Utilities', amount: 389, color: 'green.500', percentage: 18 },
    { name: 'Transport', amount: 234, color: 'yellow.500', percentage: 11 },
    { name: 'Entertainment', amount: 178, color: 'purple.500', percentage: 8 },
    { name: 'Others', amount: 923, color: 'gray.400', percentage: 42 }
  ]

  return (
    <Box
      bg="white"
      borderRadius="2xl"
      p={4}
      shadow="xs"
    >
      <Flex align="center" justify="space-between" mb={3}>
        <Heading size="sm" fontWeight="semibold" color="gray.900">
          Spending by Category
        </Heading>
        <Button
          size="xs"
          variant="ghost"
          color="blue.500"
          fontWeight="medium"
          fontSize="xs"
        >
          View All
        </Button>
      </Flex>

      <Stack gap={2}>
        {categories.map((category, index) => (
          <Flex key={index} align="center" justify="space-between">
            <Flex align="center" gap={2}>
              <Box 
                w={2} 
                h={2} 
                borderRadius="full" 
                bg={category.color}
              />
              <Text fontSize="xs" color="gray.700">
                {category.name}
              </Text>
            </Flex>
            <Flex align="center" gap={2}>
              <Text fontSize="xs" color="gray.500">
                {category.percentage}%
              </Text>
              <Text fontSize="xs" fontWeight="semibold" color="gray.900">
                ${category.amount.toLocaleString()}
              </Text>
            </Flex>
          </Flex>
        ))}
      </Stack>

      {/* Mini Chart Visualization */}
      <Box mt={3} pt={3} borderTopWidth="1px" borderTopColor="gray.100">
        <Flex h="1.5" bg="gray.100" borderRadius="full" overflow="hidden">
          {categories.map((category, index) => (
            <Box
              key={index}
              bg={category.color}
              w={`${category.percentage}%`}
            />
          ))}
        </Flex>
      </Box>
    </Box>
  )
}
