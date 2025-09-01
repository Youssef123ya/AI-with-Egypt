#!/usr/bin/env python3
"""
Azure Custom Vision Setup Script

This script sets up an Azure Custom Vision project for waste classification,
creates tags, uploads training data, and trains the initial model.

Usage:
    python setup_custom_vision.py --config config.yaml
"""

import os
import sys
import time
import json
import yaml
import argparse
from pathlib import Path
from typing import List, Dict, Any
from azure.cognitiveservices.vision.customvision.training import CustomVisionTrainingClient
from azure.cognitiveservices.vision.customvision.training.models import (
    ImageFileCreateEntry, ImageFileCreateBatch, Tag
)
from msrest.authentication import ApiKeyCredentials


class CustomVisionSetup:
    """Azure Custom Vision project setup and management."""
    
    def __init__(self, config_path: str):
        """Initialize with configuration."""
        self.config = self._load_config(config_path)
        self.training_client = self._create_training_client()
        self.project = None
        self.tags = {}
        
    def _load_config(self, config_path: str) -> Dict[str, Any]:
        """Load configuration from YAML file."""
        with open(config_path, 'r') as f:
            return yaml.safe_load(f)
    
    def _create_training_client(self) -> CustomVisionTrainingClient:
        """Create Azure Custom Vision training client."""
        training_key = self.config['azure']['custom_vision']['training_key']
        endpoint = self.config['azure']['custom_vision']['endpoint']
        
        credentials = ApiKeyCredentials(in_headers={'Training-key': training_key})
        return CustomVisionTrainingClient(endpoint, credentials)
    
    def create_project(self) -> None:
        """Create a new Custom Vision project."""
        project_name = self.config['project']['name']
        domain_id = self.config['project']['domain_id']  # General (compact) domain
        
        print(f"Creating Custom Vision project: {project_name}")
        
        # Check if project already exists
        existing_projects = self.training_client.get_projects()
        for project in existing_projects:
            if project.name == project_name:
                print(f"Project '{project_name}' already exists. Using existing project.")
                self.project = project
                return
        
        # Create new project
        self.project = self.training_client.create_project(
            name=project_name,
            domain_id=domain_id,
            classification_type="Multiclass"
        )
        
        print(f"✓ Created project with ID: {self.project.id}")
    
    def create_tags(self) -> None:
        """Create classification tags for waste categories."""
        categories = self.config['data']['categories']
        
        print("Creating classification tags...")
        
        for category_name, subcategories in categories.items():
            for subcategory in subcategories:
                tag_name = f"{category_name}_{subcategory}"
                
                try:
                    tag = self.training_client.create_tag(self.project.id, tag_name)
                    self.tags[tag_name] = tag
                    print(f"✓ Created tag: {tag_name}")
                except Exception as e:
                    if "already exists" in str(e):
                        # Get existing tag
                        existing_tags = self.training_client.get_tags(self.project.id)
                        for existing_tag in existing_tags:
                            if existing_tag.name == tag_name:
                                self.tags[tag_name] = existing_tag
                                print(f"✓ Using existing tag: {tag_name}")
                                break
                    else:
                        print(f"✗ Failed to create tag {tag_name}: {e}")
    
    def upload_training_data(self, data_path: str) -> None:
        """Upload training images to Custom Vision."""
        data_directory = Path(data_path)
        
        if not data_directory.exists():
            print(f"✗ Data directory not found: {data_path}")
            return
        
        print(f"Uploading training data from: {data_path}")
        
        # Process each category
        for category_dir in data_directory.iterdir():
            if not category_dir.is_dir():
                continue
                
            category_name = category_dir.name
            print(f"\nProcessing category: {category_name}")
            
            # Process each subcategory
            for subcategory_dir in category_dir.iterdir():
                if not subcategory_dir.is_dir():
                    continue
                    
                subcategory_name = subcategory_dir.name
                tag_name = f"{category_name}_{subcategory_name}"
                
                if tag_name not in self.tags:
                    print(f"✗ Tag not found for: {tag_name}")
                    continue
                
                # Upload images in batches
                image_files = list(subcategory_dir.glob("*.jpg")) + \
                            list(subcategory_dir.glob("*.jpeg")) + \
                            list(subcategory_dir.glob("*.png"))
                
                print(f"  Uploading {len(image_files)} images for {tag_name}")
                
                batch_size = 64  # Custom Vision limit
                for i in range(0, len(image_files), batch_size):
                    batch_files = image_files[i:i + batch_size]
                    self._upload_image_batch(batch_files, tag_name)
                    
                    # Rate limiting
                    time.sleep(1)
    
    def _upload_image_batch(self, image_files: List[Path], tag_name: str) -> None:
        """Upload a batch of images with the specified tag."""
        try:
            image_list = []
            
            for image_file in image_files:
                with open(image_file, 'rb') as f:
                    image_data = f.read()
                
                image_list.append(ImageFileCreateEntry(
                    name=image_file.name,
                    contents=image_data,
                    tag_ids=[self.tags[tag_name].id]
                ))
            
            if image_list:
                batch = ImageFileCreateBatch(images=image_list)
                result = self.training_client.create_images_from_files(
                    self.project.id, batch
                )
                
                success_count = sum(1 for image in result.images if image.status == "OK")
                print(f"    ✓ Uploaded {success_count}/{len(image_list)} images")
                
                if success_count < len(image_list):
                    failed_images = [img for img in result.images if img.status != "OK"]
                    for failed in failed_images:
                        print(f"    ✗ Failed: {failed.source_url} - {failed.status}")
                        
        except Exception as e:
            print(f"    ✗ Batch upload failed: {e}")
    
    def train_model(self) -> None:
        """Train the Custom Vision model."""
        print("\nStarting model training...")
        
        try:
            iteration = self.training_client.train_project(self.project.id)
            
            print(f"Training started. Iteration ID: {iteration.id}")
            print("Waiting for training to complete...")
            
            # Wait for training to complete
            while iteration.status != "Completed":
                time.sleep(30)
                iteration = self.training_client.get_iteration(
                    self.project.id, iteration.id
                )
                print(f"Training status: {iteration.status}")
            
            print("✓ Training completed successfully!")
            
            # Get training metrics
            self._display_training_metrics(iteration)
            
        except Exception as e:
            print(f"✗ Training failed: {e}")
    
    def _display_training_metrics(self, iteration) -> None:
        """Display training performance metrics."""
        try:
            performance = self.training_client.get_iteration_performance(
                self.project.id, iteration.id
            )
            
            print(f"\n🎯 Training Results for Iteration {iteration.name}:")
            print(f"   Precision: {performance.precision:.3f}")
            print(f"   Recall: {performance.recall:.3f}")
            print(f"   Average Precision (AP): {performance.average_precision:.3f}")
            
            # Per-tag performance
            if hasattr(performance, 'per_tag_performance'):
                print("\n📊 Per-Category Performance:")
                for tag_perf in performance.per_tag_performance:
                    print(f"   {tag_perf.name}: "
                          f"Precision={tag_perf.precision:.3f}, "
                          f"Recall={tag_perf.recall:.3f}, "
                          f"AP={tag_perf.average_precision:.3f}")
                          
        except Exception as e:
            print(f"Could not retrieve performance metrics: {e}")
    
    def publish_iteration(self, iteration_name: str = None) -> None:
        """Publish the trained iteration for prediction."""
        try:
            iterations = self.training_client.get_iterations(self.project.id)
            latest_iteration = max(iterations, key=lambda x: x.created)
            
            if iteration_name is None:
                iteration_name = f"waste_classifier_{int(time.time())}"
            
            prediction_resource_id = self.config['azure']['custom_vision']['prediction_resource_id']
            
            self.training_client.publish_iteration(
                self.project.id,
                latest_iteration.id,
                iteration_name,
                prediction_resource_id
            )
            
            print(f"✓ Published iteration as: {iteration_name}")
            print(f"Project ID: {self.project.id}")
            print(f"Iteration Name: {iteration_name}")
            
            # Save project info for later use
            project_info = {
                'project_id': self.project.id,
                'iteration_name': iteration_name,
                'endpoint': self.config['azure']['custom_vision']['endpoint'],
                'prediction_key': self.config['azure']['custom_vision']['prediction_key']
            }
            
            with open('custom_vision_project.json', 'w') as f:
                json.dump(project_info, f, indent=2)
            
            print("✓ Project information saved to custom_vision_project.json")
            
        except Exception as e:
            print(f"✗ Failed to publish iteration: {e}")
    
    def run_complete_setup(self, data_path: str) -> None:
        """Run the complete setup process."""
        print("🚀 Starting Azure Custom Vision setup for ECO-Tracking")
        print("=" * 60)
        
        try:
            self.create_project()
            self.create_tags()
            
            if data_path:
                self.upload_training_data(data_path)
                self.train_model()
                self.publish_iteration()
            else:
                print("⚠️  No data path provided. Skipping data upload and training.")
                print("   Use the Azure Custom Vision portal to upload data manually.")
            
            print("\n✅ Setup completed successfully!")
            print(f"   Project ID: {self.project.id}")
            print(f"   Custom Vision Portal: https://customvision.ai")
            
        except Exception as e:
            print(f"\n❌ Setup failed: {e}")
            sys.exit(1)


def main():
    """Main function."""
    parser = argparse.ArgumentParser(
        description="Set up Azure Custom Vision for waste classification"
    )
    parser.add_argument(
        '--config', 
        type=str, 
        default='config.yaml',
        help='Path to configuration file'
    )
    parser.add_argument(
        '--data-path', 
        type=str,
        help='Path to training data directory'
    )
    parser.add_argument(
        '--skip-training',
        action='store_true',
        help='Skip model training (only create project and tags)'
    )
    
    args = parser.parse_args()
    
    if not os.path.exists(args.config):
        print(f"❌ Configuration file not found: {args.config}")
        print("   Please create a config.yaml file with your Azure credentials.")
        sys.exit(1)
    
    setup = CustomVisionSetup(args.config)
    
    if args.skip_training:
        setup.create_project()
        setup.create_tags()
        print("✅ Project and tags created. Use Custom Vision portal for training.")
    else:
        setup.run_complete_setup(args.data_path)


if __name__ == "__main__":
    main()