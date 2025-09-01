#!/usr/bin/env python3
"""
Waste Classification Model Training Script

This script provides an alternative training approach using TensorFlow/Keras
for waste classification, which can be used alongside or instead of Azure Custom Vision.

Features:
- Data preprocessing and augmentation
- Transfer learning with pre-trained models
- Model evaluation and metrics
- Model export for deployment

Usage:
    python train_model.py --data-path data/processed --model-name efficientnet
"""

import os
import sys
import json
import argparse
from pathlib import Path
from typing import Tuple, Dict, Any, List

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import tensorflow as tf
from tensorflow.keras import layers, models, callbacks
from tensorflow.keras.applications import EfficientNetB0, ResNet50, MobileNetV2
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
import cv2
from PIL import Image


class WasteClassificationTrainer:
    """Waste classification model trainer using TensorFlow."""
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize trainer with configuration."""
        self.config = config
        self.model = None
        self.history = None
        self.class_names = []
        self.num_classes = 0
        
        # Set up GPU if available
        self._setup_gpu()
    
    def _setup_gpu(self) -> None:
        """Configure GPU settings."""
        gpus = tf.config.experimental.list_physical_devices('GPU')
        if gpus:
            try:
                for gpu in gpus:
                    tf.config.experimental.set_memory_growth(gpu, True)
                print(f"✓ GPU acceleration enabled: {len(gpus)} GPU(s) found")
            except RuntimeError as e:
                print(f"GPU setup error: {e}")
        else:
            print("No GPU found, using CPU")
    
    def load_and_preprocess_data(self, data_path: str) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """Load and preprocess the waste classification dataset."""
        print(f"Loading data from: {data_path}")
        
        data_dir = Path(data_path)
        if not data_dir.exists():
            raise FileNotFoundError(f"Data directory not found: {data_path}")
        
        images = []
        labels = []
        self.class_names = []
        
        # Get class names from directory structure
        for class_dir in sorted(data_dir.iterdir()):
            if class_dir.is_dir():
                self.class_names.append(class_dir.name)
        
        self.num_classes = len(self.class_names)
        print(f"Found {self.num_classes} classes: {self.class_names}")
        
        # Load images and labels
        for class_idx, class_name in enumerate(self.class_names):
            class_dir = data_dir / class_name
            
            image_files = []
            for ext in ['*.jpg', '*.jpeg', '*.png', '*.bmp']:
                image_files.extend(class_dir.glob(ext))
                image_files.extend(class_dir.glob(ext.upper()))
            
            print(f"  Loading {len(image_files)} images for class '{class_name}'")
            
            for img_path in image_files:
                try:
                    # Load and preprocess image
                    img = self._load_and_resize_image(img_path)
                    if img is not None:
                        images.append(img)
                        labels.append(class_idx)
                except Exception as e:
                    print(f"    Error loading {img_path}: {e}")
                    continue
        
        # Convert to numpy arrays
        X = np.array(images, dtype=np.float32) / 255.0  # Normalize to [0, 1]
        y = np.array(labels)
        
        print(f"✓ Loaded {len(X)} images with shape {X[0].shape}")
        
        # Split into train/validation/test sets
        X_train, X_temp, y_train, y_temp = train_test_split(
            X, y, test_size=0.3, random_state=42, stratify=y
        )
        X_val, X_test, y_val, y_test = train_test_split(
            X_temp, y_temp, test_size=0.5, random_state=42, stratify=y_temp
        )
        
        print(f"✓ Data split - Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")
        
        return X_train, X_val, X_test, y_train, y_val, y_test
    
    def _load_and_resize_image(self, img_path: Path, target_size: Tuple[int, int] = (224, 224)) -> np.ndarray:
        """Load and resize an image."""
        try:
            # Load image
            img = cv2.imread(str(img_path))
            if img is None:
                return None
            
            # Convert BGR to RGB
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            
            # Resize image
            img = cv2.resize(img, target_size)
            
            return img
        except Exception as e:
            print(f"Error processing {img_path}: {e}")
            return None
    
    def create_model(self, model_name: str = 'efficientnet', input_shape: Tuple[int, int, int] = (224, 224, 3)) -> models.Model:
        """Create a transfer learning model for waste classification."""
        print(f"Creating model: {model_name}")
        
        # Base model selection
        if model_name == 'efficientnet':
            base_model = EfficientNetB0(
                weights='imagenet',
                include_top=False,
                input_shape=input_shape
            )
        elif model_name == 'resnet50':
            base_model = ResNet50(
                weights='imagenet',
                include_top=False,
                input_shape=input_shape
            )
        elif model_name == 'mobilenet':
            base_model = MobileNetV2(
                weights='imagenet',
                include_top=False,
                input_shape=input_shape
            )
        else:
            raise ValueError(f"Unsupported model: {model_name}")
        
        # Freeze base model layers
        base_model.trainable = False
        
        # Add classification head
        model = models.Sequential([
            base_model,
            layers.GlobalAveragePooling2D(),
            layers.Dropout(0.3),
            layers.Dense(256, activation='relu'),
            layers.BatchNormalization(),
            layers.Dropout(0.5),
            layers.Dense(self.num_classes, activation='softmax', name='predictions')
        ])
        
        # Compile model
        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
            loss='sparse_categorical_crossentropy',
            metrics=['accuracy', 'top_k_categorical_accuracy']
        )
        
        print("✓ Model created successfully")
        print(f"   Total parameters: {model.count_params():,}")
        
        self.model = model
        return model
    
    def create_data_generators(self, X_train: np.ndarray, y_train: np.ndarray, 
                              X_val: np.ndarray, y_val: np.ndarray) -> Tuple[tf.data.Dataset, tf.data.Dataset]:
        """Create data generators with augmentation."""
        batch_size = self.config.get('batch_size', 32)
        
        # Data augmentation for training
        train_datagen = ImageDataGenerator(
            rotation_range=20,
            width_shift_range=0.1,
            height_shift_range=0.1,
            shear_range=0.1,
            zoom_range=0.1,
            horizontal_flip=True,
            brightness_range=[0.8, 1.2],
            fill_mode='nearest'
        )
        
        # No augmentation for validation
        val_datagen = ImageDataGenerator()
        
        train_generator = train_datagen.flow(
            X_train, y_train,
            batch_size=batch_size,
            shuffle=True
        )
        
        val_generator = val_datagen.flow(
            X_val, y_val,
            batch_size=batch_size,
            shuffle=False
        )
        
        print("✓ Data generators created with augmentation")
        return train_generator, val_generator
    
    def train_model(self, X_train: np.ndarray, y_train: np.ndarray,
                   X_val: np.ndarray, y_val: np.ndarray) -> None:
        """Train the waste classification model."""
        print("Starting model training...")
        
        # Create data generators
        train_gen, val_gen = self.create_data_generators(X_train, y_train, X_val, y_val)
        
        # Callbacks
        callbacks_list = [
            callbacks.EarlyStopping(
                monitor='val_loss',
                patience=10,
                restore_best_weights=True
            ),
            callbacks.ReduceLROnPlateau(
                monitor='val_loss',
                factor=0.5,
                patience=5,
                min_lr=1e-7
            ),
            callbacks.ModelCheckpoint(
                'models/best_waste_classifier.h5',
                monitor='val_accuracy',
                save_best_only=True,
                save_weights_only=False
            )
        ]
        
        # Train model
        epochs = self.config.get('epochs', 50)
        
        self.history = self.model.fit(
            train_gen,
            validation_data=val_gen,
            epochs=epochs,
            callbacks=callbacks_list,
            verbose=1
        )
        
        print("✓ Training completed")
    
    def evaluate_model(self, X_test: np.ndarray, y_test: np.ndarray) -> Dict[str, Any]:
        """Evaluate the trained model."""
        print("Evaluating model performance...")
        
        # Predictions
        y_pred_proba = self.model.predict(X_test)
        y_pred = np.argmax(y_pred_proba, axis=1)
        
        # Calculate metrics
        test_loss, test_accuracy, test_top_k = self.model.evaluate(X_test, y_test, verbose=0)
        
        # Classification report
        report = classification_report(
            y_test, y_pred, 
            target_names=self.class_names, 
            output_dict=True
        )
        
        # Confusion matrix
        cm = confusion_matrix(y_test, y_pred)
        
        results = {
            'test_loss': test_loss,
            'test_accuracy': test_accuracy,
            'test_top_k_accuracy': test_top_k,
            'classification_report': report,
            'confusion_matrix': cm.tolist(),
            'class_names': self.class_names
        }
        
        print(f"✓ Test Accuracy: {test_accuracy:.4f}")
        print(f"✓ Test Top-K Accuracy: {test_top_k:.4f}")
        
        return results
    
    def plot_training_history(self, save_path: str = 'results/training_history.png') -> None:
        """Plot training history."""
        if self.history is None:
            print("No training history available")
            return
        
        fig, axes = plt.subplots(2, 2, figsize=(12, 10))
        
        # Accuracy
        axes[0, 0].plot(self.history.history['accuracy'], label='Training')
        axes[0, 0].plot(self.history.history['val_accuracy'], label='Validation')
        axes[0, 0].set_title('Model Accuracy')
        axes[0, 0].set_xlabel('Epoch')
        axes[0, 0].set_ylabel('Accuracy')
        axes[0, 0].legend()
        
        # Loss
        axes[0, 1].plot(self.history.history['loss'], label='Training')
        axes[0, 1].plot(self.history.history['val_loss'], label='Validation')
        axes[0, 1].set_title('Model Loss')
        axes[0, 1].set_xlabel('Epoch')
        axes[0, 1].set_ylabel('Loss')
        axes[0, 1].legend()
        
        # Learning rate (if available)
        if 'lr' in self.history.history:
            axes[1, 0].plot(self.history.history['lr'])
            axes[1, 0].set_title('Learning Rate')
            axes[1, 0].set_xlabel('Epoch')
            axes[1, 0].set_ylabel('LR')
            axes[1, 0].set_yscale('log')
        
        plt.tight_layout()
        
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        plt.close()
        
        print(f"✓ Training history saved to: {save_path}")
    
    def plot_confusion_matrix(self, cm: np.ndarray, save_path: str = 'results/confusion_matrix.png') -> None:
        """Plot confusion matrix."""
        plt.figure(figsize=(10, 8))
        sns.heatmap(
            cm, 
            annot=True, 
            fmt='d', 
            cmap='Blues',
            xticklabels=self.class_names,
            yticklabels=self.class_names
        )
        plt.title('Confusion Matrix')
        plt.xlabel('Predicted')
        plt.ylabel('Actual')
        plt.xticks(rotation=45)
        plt.yticks(rotation=0)
        
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        plt.close()
        
        print(f"✓ Confusion matrix saved to: {save_path}")
    
    def save_model(self, model_path: str = 'models/waste_classifier_final.h5') -> None:
        """Save the trained model."""
        os.makedirs(os.path.dirname(model_path), exist_ok=True)
        
        self.model.save(model_path)
        
        # Save class names
        class_names_path = model_path.replace('.h5', '_classes.json')
        with open(class_names_path, 'w') as f:
            json.dump({
                'class_names': self.class_names,
                'num_classes': self.num_classes
            }, f, indent=2)
        
        print(f"✓ Model saved to: {model_path}")
        print(f"✓ Class names saved to: {class_names_path}")


def main():
    """Main training function."""
    parser = argparse.ArgumentParser(description='Train waste classification model')
    parser.add_argument('--data-path', type=str, required=True,
                       help='Path to training data directory')
    parser.add_argument('--model-name', type=str, default='efficientnet',
                       choices=['efficientnet', 'resnet50', 'mobilenet'],
                       help='Base model architecture')
    parser.add_argument('--epochs', type=int, default=50,
                       help='Number of training epochs')
    parser.add_argument('--batch-size', type=int, default=32,
                       help='Training batch size')
    parser.add_argument('--output-dir', type=str, default='results',
                       help='Output directory for results')
    
    args = parser.parse_args()
    
    # Configuration
    config = {
        'epochs': args.epochs,
        'batch_size': args.batch_size,
        'model_name': args.model_name
    }
    
    print("🚀 Starting waste classification model training")
    print("=" * 60)
    
    # Create trainer
    trainer = WasteClassificationTrainer(config)
    
    try:
        # Load data
        X_train, X_val, X_test, y_train, y_val, y_test = trainer.load_and_preprocess_data(args.data_path)
        
        # Create model
        trainer.create_model(args.model_name)
        
        # Train model
        trainer.train_model(X_train, y_train, X_val, y_val)
        
        # Evaluate model
        results = trainer.evaluate_model(X_test, y_test)
        
        # Save results
        os.makedirs(args.output_dir, exist_ok=True)
        
        with open(f'{args.output_dir}/evaluation_results.json', 'w') as f:
            json.dump(results, f, indent=2, default=str)
        
        # Plot results
        trainer.plot_training_history(f'{args.output_dir}/training_history.png')
        trainer.plot_confusion_matrix(
            np.array(results['confusion_matrix']), 
            f'{args.output_dir}/confusion_matrix.png'
        )
        
        # Save model
        trainer.save_model(f'{args.output_dir}/waste_classifier.h5')
        
        print("\n✅ Training completed successfully!")
        print(f"   Final test accuracy: {results['test_accuracy']:.4f}")
        print(f"   Results saved to: {args.output_dir}")
        
    except Exception as e:
        print(f"\n❌ Training failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()