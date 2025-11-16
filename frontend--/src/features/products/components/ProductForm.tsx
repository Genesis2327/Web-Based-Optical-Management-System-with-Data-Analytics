import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Product, ProductFormData, ProductCategory } from '../types/product.types';
import { ImageReorderer } from './ImageReorderer';
import { Loader2, Upload, Image as ImageIcon } from 'lucide-react';

// Validation schema
const productFormSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(255),
  description: z.string().min(1, 'Description is required'),
  price: z.number().min(0.01, 'Price must be greater than 0'),
  category_id: z.number().optional(),
  stock_quantity: z.number().min(0, 'Stock quantity cannot be negative').int(),
  is_active: z.boolean().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  sku: z.string().optional(),
  branch_id: z.number().optional(),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

interface ProductFormProps {
  product?: Product | null;
  categories?: ProductCategory[];
  onSubmit: (data: ProductFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export const ProductForm: React.FC<ProductFormProps> = ({
  product,
  categories = [],
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [primaryImageIndex, setPrimaryImageIndex] = useState<number>(0);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: product?.name || '',
      description: product?.description || '',
      price: product?.price || 0,
      category_id: product?.category_id || undefined,
      stock_quantity: product?.stock_quantity || 0,
      is_active: product?.is_active ?? true,
      brand: product?.brand || '',
      model: product?.model || '',
      sku: product?.sku || '',
      branch_id: product?.branch_id || undefined,
    },
  });

  const isActive = watch('is_active');

  // Reset form when product changes
  useEffect(() => {
    if (product) {
      reset({
        name: product.name,
        description: product.description,
        price: product.price,
        category_id: product.category_id,
        stock_quantity: product.stock_quantity,
        is_active: product.is_active,
        brand: product.brand || '',
        model: product.model || '',
        sku: product.sku || '',
        branch_id: product.branch_id,
      });
      
      // Set existing image previews
      if (product.image_paths && product.image_paths.length > 0) {
        const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';
        const baseUrl = apiBaseUrl.replace('/api', '');
        const previews = product.image_paths.map(path => `${baseUrl}/storage/${path}`);
        setImagePreviews(previews);
      }
    } else {
      reset({
        name: '',
        description: '',
        price: 0,
        category_id: undefined,
        stock_quantity: 0,
        is_active: true,
        brand: '',
        model: '',
        sku: '',
        branch_id: undefined,
      });
      setImagePreviews([]);
      setImageFiles([]);
    }
  }, [product, reset]);

  // Handle image file selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Validate file types
    const validFiles = files.filter(file => {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        alert(`${file.name} is not a valid image type. Please use JPG, PNG, GIF, or WebP.`);
        return false;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert(`${file.name} is too large. Maximum file size is 5MB.`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setImageFiles(prevFiles => [...prevFiles, ...validFiles]);

    // Create previews
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Handle image reordering
  const handleImageReorder = (newOrder: Array<{file: File; preview: string; name: string; size: number}>) => {
    const newFiles = newOrder.map(item => item.file);
    const newPreviews = newOrder.map(item => item.preview);
    
    setImageFiles(newFiles);
    setImagePreviews(newPreviews);
    
    // Adjust primary index if needed
    if (primaryImageIndex >= newOrder.length) {
      setPrimaryImageIndex(Math.max(0, newOrder.length - 1));
    }
  };

  // Handle image removal
  const handleImageRemove = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    
    // Adjust primary index if needed
    if (primaryImageIndex >= index && primaryImageIndex > 0) {
      setPrimaryImageIndex(primaryImageIndex - 1);
    } else if (primaryImageIndex >= imageFiles.length - 1) {
      setPrimaryImageIndex(Math.max(0, imageFiles.length - 2));
    }
  };

  // Handle primary image change
  const handlePrimaryImageChange = (index: number) => {
    setPrimaryImageIndex(index);
  };

  // Handle form submission
  const onFormSubmit = async (data: ProductFormValues) => {
    const formData: ProductFormData = {
      ...data,
      images: imageFiles.length > 0 ? imageFiles : undefined,
    };

    await onSubmit(formData);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{product ? 'Edit Product' : 'Add New Product'}</CardTitle>
        <CardDescription>
          {product ? 'Update product information' : 'Fill in the details to create a new product'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Basic Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Product Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Product Name *</Label>
                <Input
                  id="name"
                  {...register('name')}
                  placeholder="e.g., Ray-Ban Aviator"
                />
                {errors.name && (
                  <p className="text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              {/* SKU */}
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  {...register('sku')}
                  placeholder="e.g., RB-AV-001"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Detailed product description..."
                rows={4}
              />
              {errors.description && (
                <p className="text-sm text-red-600">{errors.description.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category_id">Category</Label>
                <Select
                  value={watch('category_id')?.toString()}
                  onValueChange={(value) => setValue('category_id', parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Brand */}
              <div className="space-y-2">
                <Label htmlFor="brand">Brand</Label>
                <Input
                  id="brand"
                  {...register('brand')}
                  placeholder="e.g., Ray-Ban"
                />
              </div>

              {/* Model */}
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  {...register('model')}
                  placeholder="e.g., Aviator Classic"
                />
              </div>
            </div>
          </div>

          {/* Pricing & Inventory */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Pricing & Inventory</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Price */}
              <div className="space-y-2">
                <Label htmlFor="price">Price (₱) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  {...register('price', { valueAsNumber: true })}
                  placeholder="0.00"
                />
                {errors.price && (
                  <p className="text-sm text-red-600">{errors.price.message}</p>
                )}
              </div>

              {/* Stock Quantity */}
              <div className="space-y-2">
                <Label htmlFor="stock_quantity">Stock Quantity *</Label>
                <Input
                  id="stock_quantity"
                  type="number"
                  {...register('stock_quantity', { valueAsNumber: true })}
                  placeholder="0"
                />
                {errors.stock_quantity && (
                  <p className="text-sm text-red-600">{errors.stock_quantity.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Product Images */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Product Images</h3>
            
            {/* Image Upload */}
            <div className="space-y-2">
              <Label htmlFor="images">Upload Images</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="images"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('images')?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Choose Images
                </Button>
                <p className="text-sm text-gray-500">
                  JPG, PNG, GIF or WebP (Max 5MB each). Use the reorderer below to manage image order.
                </p>
              </div>
            </div>

            {/* Image Management */}
            {imagePreviews.length > 0 && (
              <ImageReorderer
                images={imageFiles.map((file, index) => ({
                  file,
                  preview: imagePreviews[index],
                  name: file.name,
                  size: file.size
                }))}
                onReorder={handleImageReorder}
                onRemove={handleImageRemove}
                onSetPrimary={handlePrimaryImageChange}
                primaryIndex={primaryImageIndex}
              />
            )}

            {imagePreviews.length === 0 && (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <ImageIcon className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">No images uploaded yet</p>
              </div>
            )}
          </div>

          {/* Status */}
          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={isActive}
              onCheckedChange={(checked) => setValue('is_active', checked)}
            />
            <Label htmlFor="is_active">Product is active and visible</Label>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {product ? 'Update Product' : 'Create Product'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};















