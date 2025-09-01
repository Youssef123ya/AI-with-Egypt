import { useState, useRef } from 'react';
import {
  Container,
  Title,
  Paper,
  Stack,
  Group,
  Button,
  Text,
  Image,
  Alert,
  Badge,
  Card,
  SimpleGrid,
  Center,
  Box,
  ActionIcon,
  Loader,
  Progress,
  Divider,
} from '@mantine/core';
import { Dropzone, FileWithPath, IMAGE_MIME_TYPE } from '@mantine/dropzone';
import {
  IconUpload,
  IconX,
  IconPhoto,
  IconCamera,
  IconRecycle,
  IconLeaf,
  IconBolt,
  IconTrophy,
  IconCheck,
  IconAlertCircle,
  IconRefresh,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useRouter } from 'next/router';
import { useMutation } from '@tanstack/react-query';
import AppLayout from '@/components/ui/AppLayout';
import { recyclingAPI } from '@/utils/api';
import { ClassificationResult, WasteCategory } from '@/types';

interface ClassificationResultDisplay {
  itemType: string;
  category: WasteCategory;
  subcategory: string;
  confidence: number;
  environmentalImpact?: {
    co2Saved: number;
    energySaved: number;
    pointsEarned: number;
  };
}

const categoryColors: Record<WasteCategory, string> = {
  recyclable: 'green',
  organic: 'yellow',
  hazardous: 'red',
  non_recyclable: 'gray',
};

const categoryDescriptions: Record<WasteCategory, string> = {
  recyclable: 'Can be recycled and reused',
  organic: 'Biodegradable organic waste',
  hazardous: 'Requires special disposal',
  non_recyclable: 'Cannot be recycled',
};

function getEnvironmentalImpact(category: WasteCategory, subcategory: string) {
  const impactData: Record<string, { co2: number; energy: number; points: number }> = {
    'plastic_bottles': { co2: 0.5, energy: 0.8, points: 10 },
    'glass': { co2: 0.3, energy: 0.6, points: 8 },
    'paper': { co2: 1.0, energy: 1.2, points: 12 },
    'cans': { co2: 1.5, energy: 2.0, points: 15 },
    'cardboard': { co2: 0.8, energy: 1.0, points: 10 },
    'food_scraps': { co2: 0.2, energy: 0.1, points: 5 },
    'yard_trimmings': { co2: 0.3, energy: 0.2, points: 6 },
    'coffee_tea_bags': { co2: 0.1, energy: 0.05, points: 3 },
    'egg_shells': { co2: 0.05, energy: 0.02, points: 2 },
    'kitchen_waste': { co2: 0.15, energy: 0.08, points: 4 },
    'batteries': { co2: 2.0, energy: 3.0, points: 25 },
    'e_waste': { co2: 5.0, energy: 8.0, points: 50 },
    'paints': { co2: 1.2, energy: 1.8, points: 20 },
    'pesticides': { co2: 1.5, energy: 2.2, points: 22 },
  };

  return impactData[subcategory] || { co2: 0, energy: 0, points: 0 };
}

export default function ClassifyPage() {
  const [selectedFile, setSelectedFile] = useState<FileWithPath | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [classificationResult, setClassificationResult] = useState<ClassificationResultDisplay | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const classificationMutation = useMutation({
    mutationFn: (file: File) => recyclingAPI.classify(file, true),
    onSuccess: (data) => {
      if (data.success && data.data.classification) {
        const classification = data.data.classification;
        const impact = getEnvironmentalImpact(classification.category, classification.subcategory);
        
        setClassificationResult({
          ...classification,
          environmentalImpact: impact,
        });

        notifications.show({
          title: 'Classification Complete!',
          message: `Identified as ${classification.itemType} with ${Math.round(classification.confidence * 100)}% confidence`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      } else {
        notifications.show({
          title: 'Classification Failed',
          message: data.message || 'Unable to classify the image',
          color: 'orange',
          icon: <IconAlertCircle size={16} />,
        });
      }
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Classification Error',
        message: error.message || 'Failed to classify image',
        color: 'red',
        icon: <IconX size={16} />,
      });
    },
  });

  const handleFileSelect = (files: FileWithPath[]) => {
    const file = files[0];
    if (file) {
      setSelectedFile(file);
      setClassificationResult(null);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files[0]) {
      handleFileSelect([files[0] as FileWithPath]);
    }
  };

  const handleClassify = () => {
    if (selectedFile) {
      classificationMutation.mutate(selectedFile);
    }
  };

  const handleLogEntry = () => {
    if (classificationResult) {
      router.push({
        pathname: '/log',
        query: {
          itemType: classificationResult.itemType,
          category: classificationResult.category,
          subcategory: classificationResult.subcategory,
          confidence: classificationResult.confidence,
          imageUrl: previewUrl,
        },
      });
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setClassificationResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <AppLayout>
      <Container size="md">
        <Stack spacing="xl">
          <div>
            <Title order={2} mb="sm">
              <Group spacing="xs">
                <IconCamera size={28} />
                Classify Waste Item
              </Group>
            </Title>
            <Text c="dimmed" size="lg">
              Upload or take a photo to identify and classify your waste item
            </Text>
          </div>

          {/* File Upload Section */}
          <Paper p="xl" radius="md" withBorder>
            {!selectedFile ? (
              <Dropzone
                onDrop={handleFileSelect}
                onReject={(files) => {
                  notifications.show({
                    title: 'File Rejected',
                    message: 'Please select a valid image file (JPEG, PNG, WebP)',
                    color: 'red',
                  });
                }}
                maxSize={10 * 1024 ** 2} // 10MB
                accept={IMAGE_MIME_TYPE}
                multiple={false}
                style={{
                  border: dragActive ? '2px dashed #339933' : '2px dashed #e9ecef',
                  borderRadius: '12px',
                  backgroundColor: dragActive ? '#f8f9fa' : 'transparent',
                }}
              >
                <Group position="center" spacing="xl" style={{ minHeight: 220, pointerEvents: 'none' }}>
                  <Dropzone.Accept>
                    <IconUpload size={52} color="#339933" stroke={1.5} />
                  </Dropzone.Accept>
                  <Dropzone.Reject>
                    <IconX size={52} color="#fa5252" stroke={1.5} />
                  </Dropzone.Reject>
                  <Dropzone.Idle>
                    <IconPhoto size={52} color="#868e96" stroke={1.5} />
                  </Dropzone.Idle>

                  <div>
                    <Text size="xl" inline>
                      Drag image here or click to select
                    </Text>
                    <Text size="sm" c="dimmed" inline mt={7}>
                      Attach image files (max 10MB each)
                    </Text>
                  </div>
                </Group>
              </Dropzone>
            ) : (
              <Stack>
                <Center>
                  <Image
                    src={previewUrl}
                    alt="Selected waste item"
                    radius="md"
                    fit="contain"
                    style={{ maxHeight: 300, maxWidth: '100%' }}
                  />
                </Center>
                
                <Group position="center" spacing="md">
                  <Button
                    onClick={handleClassify}
                    loading={classificationMutation.isPending}
                    color="green"
                    size="lg"
                    leftIcon={<IconRecycle size={20} />}
                    disabled={classificationMutation.isPending}
                  >
                    {classificationMutation.isPending ? 'Classifying...' : 'Classify Item'}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    leftIcon={<IconRefresh size={16} />}
                    disabled={classificationMutation.isPending}
                  >
                    Select Different Image
                  </Button>
                </Group>

                {classificationMutation.isPending && (
                  <Box>
                    <Progress value={30} animated color="green" size="sm" radius="xl" />
                    <Text size="sm" c="dimmed" ta="center" mt="xs">
                      Analyzing image with AI...
                    </Text>
                  </Box>
                )}
              </Stack>
            )}

            {/* Alternative Input Method */}
            {!selectedFile && (
              <>
                <Divider label="Or" labelPosition="center" my="lg" />
                <Group position="center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileInput}
                    style={{ display: 'none' }}
                  />
                  <Button
                    variant="outline"
                    leftIcon={<IconCamera size={16} />}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose from Device
                  </Button>
                </Group>
              </>
            )}
          </Paper>

          {/* Classification Results */}
          {classificationResult && (
            <Paper p="xl" radius="md" withBorder>
              <Stack spacing="lg">
                <Group position="apart">
                  <Title order={3}>Classification Results</Title>
                  <Badge
                    color={categoryColors[classificationResult.category]}
                    variant="filled"
                    size="lg"
                  >
                    {Math.round(classificationResult.confidence * 100)}% Confident
                  </Badge>
                </Group>

                <SimpleGrid cols={1} spacing="md">
                  <Card p="lg" radius="md" withBorder>
                    <Group position="apart" mb="md">
                      <div>
                        <Text size="xl" fw={700} mb="xs">
                          {classificationResult.itemType}
                        </Text>
                        <Badge
                          color={categoryColors[classificationResult.category]}
                          variant="light"
                          size="md"
                          tt="capitalize"
                        >
                          {classificationResult.category}
                        </Badge>
                      </div>
                      <ActionIcon
                        size={48}
                        radius="xl"
                        color={categoryColors[classificationResult.category]}
                        variant="light"
                      >
                        <IconRecycle size={24} />
                      </ActionIcon>
                    </Group>

                    <Text c="dimmed" mb="lg">
                      {categoryDescriptions[classificationResult.category]}
                    </Text>

                    {classificationResult.environmentalImpact && (
                      <SimpleGrid cols={3} spacing="md">
                        <div>
                          <Group spacing="xs" mb="xs">
                            <IconLeaf size={16} color="#339933" />
                            <Text size="sm" fw={600}>CO₂ Saved</Text>
                          </Group>
                          <Text size="lg" fw={700} c="green">
                            {classificationResult.environmentalImpact.co2Saved} kg
                          </Text>
                        </div>
                        
                        <div>
                          <Group spacing="xs" mb="xs">
                            <IconBolt size={16} color="#f59f00" />
                            <Text size="sm" fw={600}>Energy Saved</Text>
                          </Group>
                          <Text size="lg" fw={700} c="yellow">
                            {classificationResult.environmentalImpact.energySaved} kWh
                          </Text>
                        </div>
                        
                        <div>
                          <Group spacing="xs" mb="xs">
                            <IconTrophy size={16} color="#ff6b35" />
                            <Text size="sm" fw={600}>Points Earned</Text>
                          </Group>
                          <Text size="lg" fw={700} c="orange">
                            +{classificationResult.environmentalImpact.pointsEarned}
                          </Text>
                        </div>
                      </SimpleGrid>
                    )}
                  </Card>
                </SimpleGrid>

                {classificationResult.category === 'non_recyclable' && (
                  <Alert icon={<IconAlertCircle size={16} />} color="orange">
                    This item cannot be recycled through standard programs. Please check with your local waste management for proper disposal methods.
                  </Alert>
                )}

                {classificationResult.category === 'hazardous' && (
                  <Alert icon={<IconAlertCircle size={16} />} color="red">
                    This is hazardous waste that requires special handling. Please take it to a designated hazardous waste collection facility.
                  </Alert>
                )}

                <Group position="center" spacing="md">
                  <Button
                    size="lg"
                    color="green"
                    leftIcon={<IconCheck size={20} />}
                    onClick={handleLogEntry}
                  >
                    Log This Entry
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    leftIcon={<IconRefresh size={16} />}
                  >
                    Classify Another Item
                  </Button>
                </Group>
              </Stack>
            </Paper>
          )}

          {/* Tips Section */}
          <Paper p="lg" radius="md" withBorder bg="green.0">
            <Title order={4} mb="md" c="green.7">
              📸 Tips for Better Results
            </Title>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Stack spacing="xs">
                <Text size="sm">• Take clear, well-lit photos</Text>
                <Text size="sm">• Ensure the item fills most of the frame</Text>
                <Text size="sm">• Avoid cluttered backgrounds</Text>
              </Stack>
              <Stack spacing="xs">
                <Text size="sm">• Clean items work better than dirty ones</Text>
                <Text size="sm">• Multiple angles can help accuracy</Text>
                <Text size="sm">• Remove labels if possible</Text>
              </Stack>
            </SimpleGrid>
          </Paper>
        </Stack>
      </Container>
    </AppLayout>
  );
}