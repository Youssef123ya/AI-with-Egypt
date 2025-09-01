import { useState, useEffect } from 'react';
import {
  Container,
  Title,
  SimpleGrid,
  Card,
  Text,
  Group,
  Stack,
  Progress,
  Badge,
  ActionIcon,
  Button,
  Box,
  ThemeIcon,
  RingProgress,
  Center,
  Skeleton,
  Grid,
  Paper,
} from '@mantine/core';
import {
  IconRecycle,
  IconLeaf,
  IconBolt,
  IconTrophy,
  IconCamera,
  IconPlus,
  IconMap2,
  IconTrendingUp,
  IconCalendar,
  IconUsers,
  IconChartBar,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import AppLayout from '@/components/ui/AppLayout';
import useAuth from '@/hooks/useAuth';
import { recyclingAPI } from '@/utils/api';
import { RecyclingStatistics } from '@/types';
import { useRouter } from 'next/router';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#339933', '#66bb6a', '#81c784', '#a5d6a7'];

interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
  color: string;
  progress?: number;
}

function StatCard({ title, value, description, icon, color, progress }: StatCardProps) {
  return (
    <Card p="lg" radius="md" withBorder>
      <Group position="apart">
        <div>
          <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
            {title}
          </Text>
          <Text fw={700} size="xl">
            {value}
          </Text>
          <Text c="dimmed" size="xs">
            {description}
          </Text>
        </div>
        <ThemeIcon color={color} size={38} radius="md">
          {icon}
        </ThemeIcon>
      </Group>
      {progress !== undefined && (
        <Progress value={progress} mt="md" size="sm" radius="xl" />
      )}
    </Card>
  );
}

interface QuickActionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  href: string;
}

function QuickAction({ title, description, icon, color, href }: QuickActionProps) {
  const router = useRouter();

  return (
    <Card 
      p="lg" 
      radius="md" 
      withBorder 
      style={{ cursor: 'pointer' }}
      onClick={() => router.push(href)}
    >
      <Stack align="center" spacing="sm">
        <ThemeIcon color={color} size={48} radius="xl">
          {icon}
        </ThemeIcon>
        <Text fw={600} ta="center">{title}</Text>
        <Text size="sm" c="dimmed" ta="center">{description}</Text>
      </Stack>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  const { data: userStats, isLoading: statsLoading } = useQuery({
    queryKey: ['user-statistics', 'all'],
    queryFn: () => recyclingAPI.getStatistics('all'),
  });

  const { data: weeklyStats } = useQuery({
    queryKey: ['user-statistics', 'week'],
    queryFn: () => recyclingAPI.getStatistics('week'),
  });

  const { data: globalStats } = useQuery({
    queryKey: ['global-statistics', 'all'],
    queryFn: () => recyclingAPI.getGlobalStats('all'),
  });

  const { data: trends } = useQuery({
    queryKey: ['recycling-trends', 'month', 'day'],
    queryFn: () => recyclingAPI.getTrends('month', 'day'),
  });

  const statistics = userStats?.data?.statistics;
  const weeklyData = weeklyStats?.data?.statistics;
  const globalData = globalStats?.data?.statistics;
  const trendData = trends?.data?.trends || [];

  // Calculate progress towards goals
  const monthlyGoal = 50; // items per month
  const weeklyProgress = weeklyData ? (weeklyData.totalItems / 10) * 100 : 0; // 10 items per week goal
  const co2Goal = 20; // kg CO2 saved per month
  const co2Progress = weeklyData ? (weeklyData.totalCO2Saved / co2Goal) * 100 : 0;

  // Prepare chart data
  const chartData = trendData.slice(-7).map(item => ({
    date: new Date(item.period).toLocaleDateString('en-US', { weekday: 'short' }),
    items: item.count,
    co2: item.co2Saved,
  }));

  const pieData = statistics?.categoryBreakdown.map((item, index) => ({
    name: item.category,
    value: item.count,
    color: COLORS[index % COLORS.length],
  })) || [];

  if (statsLoading) {
    return (
      <AppLayout>
        <Container fluid>
          <Skeleton height={50} mb="xl" />
          <SimpleGrid cols={4} spacing="lg" mb="xl">
            {Array(4).fill(0).map((_, i) => (
              <Skeleton key={i} height={120} />
            ))}
          </SimpleGrid>
          <Grid>
            <Grid.Col span={8}>
              <Skeleton height={300} />
            </Grid.Col>
            <Grid.Col span={4}>
              <Skeleton height={300} />
            </Grid.Col>
          </Grid>
        </Container>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Container fluid>
        <Group position="apart" mb="xl">
          <div>
            <Title order={2}>Welcome back, {user?.name}! 👋</Title>
            <Text c="dimmed" size="lg">
              Here's your recycling impact summary
            </Text>
          </div>
          <Group>
            <Button 
              leftIcon={<IconCamera size={16} />} 
              color="green"
              onClick={() => router.push('/classify')}
            >
              Classify Item
            </Button>
            <Button 
              leftIcon={<IconPlus size={16} />} 
              variant="outline"
              onClick={() => router.push('/log')}
            >
              Log Entry
            </Button>
          </Group>
        </Group>

        {/* Statistics Cards */}
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg" mb="xl">
          <StatCard
            title="Items Recycled"
            value={statistics?.totalItems || 0}
            description="All time total"
            icon={<IconRecycle size={18} />}
            color="green"
            progress={weeklyProgress}
          />
          <StatCard
            title="CO₂ Saved"
            value={`${(statistics?.totalCO2Saved || 0).toFixed(1)} kg`}
            description="Environmental impact"
            icon={<IconLeaf size={18} />}
            color="teal"
            progress={co2Progress}
          />
          <StatCard
            title="Energy Saved"
            value={`${(statistics?.totalEnergySaved || 0).toFixed(1)} kWh`}
            description="Power conservation"
            icon={<IconBolt size={18} />}
            color="yellow"
          />
          <StatCard
            title="Points Earned"
            value={statistics?.totalPoints || 0}
            description="Reward points"
            icon={<IconTrophy size={18} />}
            color="orange"
          />
        </SimpleGrid>

        {/* Charts and Analytics */}
        <Grid>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Card p="lg" radius="md" withBorder>
              <Group position="apart" mb="lg">
                <Text size="lg" fw={600}>Recycling Trend (Last 7 Days)</Text>
                <ActionIcon 
                  variant="subtle" 
                  color="gray"
                  onClick={() => router.push('/analytics')}
                >
                  <IconChartBar size={16} />
                </ActionIcon>
              </Group>
              <Box style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="items" 
                      stroke="#339933" 
                      strokeWidth={2}
                      name="Items Recycled"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 4 }}>
            <Card p="lg" radius="md" withBorder style={{ height: 'fit-content' }}>
              <Text size="lg" fw={600} mb="lg">Category Breakdown</Text>
              {pieData.length > 0 ? (
                <Box style={{ width: '100%', height: 200 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              ) : (
                <Center py="xl">
                  <Text c="dimmed">No data available</Text>
                </Center>
              )}
              <Stack spacing="xs" mt="md">
                {pieData.map((item, index) => (
                  <Group key={index} position="apart">
                    <Group spacing="xs">
                      <Box
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 2,
                          backgroundColor: item.color,
                        }}
                      />
                      <Text size="sm" tt="capitalize">{item.name}</Text>
                    </Group>
                    <Text size="sm" fw={600}>{item.value}</Text>
                  </Group>
                ))}
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Quick Actions */}
        <Title order={3} mt="xl" mb="lg">Quick Actions</Title>
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="lg" mb="xl">
          <QuickAction
            title="Classify Item"
            description="Scan & identify waste"
            icon={<IconCamera size={20} />}
            color="green"
            href="/classify"
          />
          <QuickAction
            title="Find Centers"
            description="Locate nearby facilities"
            icon={<IconMap2 size={20} />}
            color="blue"
            href="/map"
          />
          <QuickAction
            title="View History"
            description="Past recycling entries"
            icon={<IconCalendar size={20} />}
            color="violet"
            href="/history"
          />
          <QuickAction
            title="Community Stats"
            description="Global impact data"
            icon={<IconUsers size={20} />}
            color="orange"
            href="/community"
          />
        </SimpleGrid>

        {/* Global Impact */}
        {globalData && (
          <Card p="lg" radius="md" withBorder>
            <Group position="apart" mb="lg">
              <div>
                <Text size="lg" fw={600}>Community Impact</Text>
                <Text c="dimmed" size="sm">Global recycling statistics</Text>
              </div>
              <Badge color="green" variant="light" leftSection={<IconTrendingUp size={12} />}>
                Growing
              </Badge>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="lg">
              <div>
                <Text size="xl" fw={700} c="green">
                  {globalData.totalItems?.toLocaleString() || 0}
                </Text>
                <Text size="xs" c="dimmed" tt="uppercase">Total Items</Text>
              </div>
              <div>
                <Text size="xl" fw={700} c="teal">
                  {globalData.totalUsers?.toLocaleString() || 0}
                </Text>
                <Text size="xs" c="dimmed" tt="uppercase">Active Users</Text>
              </div>
              <div>
                <Text size="xl" fw={700} c="blue">
                  {globalData.totalCO2Saved?.toFixed(1) || 0} kg
                </Text>
                <Text size="xs" c="dimmed" tt="uppercase">CO₂ Saved</Text>
              </div>
              <div>
                <Text size="xl" fw={700} c="yellow">
                  {globalData.totalEnergySaved?.toFixed(1) || 0} kWh
                </Text>
                <Text size="xs" c="dimmed" tt="uppercase">Energy Saved</Text>
              </div>
            </SimpleGrid>
          </Card>
        )}
      </Container>
    </AppLayout>
  );
}