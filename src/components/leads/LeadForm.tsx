import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { PRODUCT_CATEGORIES } from '../../lib/constants';
import type { FormType } from '../../types/lead';

export interface LeadFormProps {
  onSubmit: (data: any) => Promise<void> | void;
  initialData?: any;
  loading?: boolean;
  className?: string;
}

export const LeadForm: React.FC<LeadFormProps> = ({
  onSubmit,
  initialData = {},
  loading = false,
  className = '',
}) => {
  const [formData, setFormData] = useState({
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    company: initialData?.company || '',
    deliveryZip: initialData?.deliveryZip || '',
    productCategory: initialData?.productCategory || PRODUCT_CATEGORIES[0],
    productTitle: initialData?.productTitle || '',
    productPrice: initialData?.productPrice || '',
    quantity: initialData?.quantity || 1,
    targetBudget: initialData?.targetBudget || '',
    timeline: initialData?.timeline || '',
    projectDetails: initialData?.projectDetails || '',
    sourceChannel: initialData?.source?.utm_source || 'manual',
    formType: (initialData?.formType || 'quote') as FormType,
    honeypot: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      setFormData((prev) => ({
        ...prev,
        firstName: initialData.firstName || prev.firstName,
        lastName: initialData.lastName || prev.lastName,
        email: initialData.email || prev.email,
        phone: initialData.phone || prev.phone,
        company: initialData.company || prev.company,
        deliveryZip: initialData.deliveryZip || prev.deliveryZip,
        productCategory: initialData.productCategory || prev.productCategory,
        productTitle: initialData.productTitle || prev.productTitle,
        productPrice: initialData.productPrice || prev.productPrice,
        quantity: initialData.quantity || prev.quantity,
        targetBudget: initialData.targetBudget || prev.targetBudget,
        timeline: initialData.timeline || prev.timeline,
        projectDetails: initialData.projectDetails || prev.projectDetails,
        sourceChannel: initialData.source?.utm_source || prev.sourceChannel,
        formType: initialData.formType || prev.formType,
      }));
    }
  }, [initialData]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    const val = type === 'number' ? Number(value) : value;

    setFormData((prev) => ({ ...prev, [name]: val }));
    if (errors[name]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email address';
    }
    if (!formData.productCategory) newErrors.productCategory = 'Please select a category';
    if (formData.quantity < 1) newErrors.quantity = 'Quantity must be at least 1';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Hidden honeypot validation
    if (formData.honeypot) {
      console.warn('Spam submission detected via honeypot.');
      return;
    }

    if (!validate()) return;

    const sourceByChannel = {
      manual: { utm_source: 'manual' },
      direct: {},
      google: { utm_source: 'google', utm_medium: 'cpc' },
      phone: { utm_source: 'phone' },
      referral: { utm_source: 'referral', referrer: 'manual-referral' },
      email: { utm_source: 'email', utm_medium: 'email' },
    } as const;

    await onSubmit({
      ...formData,
      quantity: Number(formData.quantity) || 1,
      productPrice: formData.productPrice === '' ? undefined : Number(formData.productPrice),
      source: sourceByChannel[formData.sourceChannel as keyof typeof sourceByChannel] || { utm_source: 'manual' },
    });
  };

  const categoryOptions = PRODUCT_CATEGORIES.map((cat) => ({
    value: cat,
    label: cat,
  }));

  const formTypeOptions = [
    { value: 'quote', label: 'Quote Request' },
    { value: 'contact', label: 'General Contact' },
    { value: 'product_inquiry', label: 'Product Inquiry' },
  ];

  const sourceOptions = [
    { value: 'manual', label: 'Manual Entry' },
    { value: 'direct', label: 'Direct' },
    { value: 'google', label: 'Google Ads' },
    { value: 'phone', label: 'Phone Call' },
    { value: 'referral', label: 'Referral' },
    { value: 'email', label: 'Email' },
  ];

  return (
    <form onSubmit={handleSubmit} className={`space-y-6 ${className}`} noValidate>
      {/* Hidden Honeypot field for spam protection */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="honeypot">Do not fill this field out</label>
        <input
          type="text"
          id="honeypot"
          name="honeypot"
          value={formData.honeypot}
          onChange={handleChange}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {/* Section 1: Contact Information */}
      <div className="bg-surface-900 p-5 rounded-xl border border-surface-800 space-y-4">
        <h4 className="text-sm font-semibold text-white uppercase tracking-wider border-b border-surface-800 pb-2">
          Contact Information
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="First Name *"
            name="firstName"
            value={formData.firstName}
            onChange={handleChange}
            error={errors.firstName}
            placeholder="John"
            required
          />
          <Input
            label="Last Name *"
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
            error={errors.lastName}
            placeholder="Doe"
            required
          />
          <Input
            label="Email Address *"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            error={errors.email}
            placeholder="john@garageautosupplies.com"
            required
          />
          <Input
            label="Phone Number"
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="(555) 123-4567"
          />
          <Input
            label="Company Name"
            name="company"
            value={formData.company}
            onChange={handleChange}
            placeholder="Auto Repair Shop LLC"
          />
          <Input
            label="Delivery Zip / Postal Code"
            name="deliveryZip"
            value={formData.deliveryZip}
            onChange={handleChange}
            placeholder="90210"
          />
        </div>
      </div>

      {/* Section 2: Product & Project Details */}
      <div className="bg-surface-900 p-5 rounded-xl border border-surface-800 space-y-4">
        <h4 className="text-sm font-semibold text-white uppercase tracking-wider border-b border-surface-800 pb-2">
          Product & Inquiry Specifications
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Product Category *"
            name="productCategory"
            value={formData.productCategory}
            onChange={handleChange}
            options={categoryOptions}
            error={errors.productCategory}
          />
          <Input
            label="Product Title"
            name="productTitle"
            value={formData.productTitle}
            onChange={handleChange}
            placeholder="Atlas 4-Post Commercial Lift"
          />
          <Input
            label="Product Price"
            type="number"
            min={0}
            name="productPrice"
            value={formData.productPrice}
            onChange={handleChange}
            placeholder="12500"
          />
          <Input
            label="Quantity *"
            type="number"
            min={1}
            name="quantity"
            value={formData.quantity}
            onChange={handleChange}
            error={errors.quantity}
          />
          <Input
            label="Budget"
            name="targetBudget"
            value={formData.targetBudget}
            onChange={handleChange}
            placeholder="$5,000 - $10,000"
          />
          <Input
            label="Timeline"
            name="timeline"
            value={formData.timeline}
            onChange={handleChange}
            placeholder="Ready this month"
          />
          <Select
            label="Source"
            name="sourceChannel"
            value={formData.sourceChannel}
            onChange={handleChange}
            options={sourceOptions}
          />
          <Select
            label="Inquiry Type"
            name="formType"
            value={formData.formType}
            onChange={handleChange}
            options={formTypeOptions}
          />
          <div className="md:col-span-2">
            <label
              htmlFor="projectDetails"
              className="block text-sm font-medium text-surface-200 mb-1.5"
            >
              Project Details & Requirements
            </label>
            <textarea
              id="projectDetails"
              name="projectDetails"
              rows={4}
              value={formData.projectDetails}
              onChange={handleChange}
              placeholder="Describe lift height limits, power requirements, installation timeline, etc."
              className="w-full bg-surface-800 border border-surface-700 rounded-lg p-3 text-white placeholder-surface-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors resize-y"
            />
          </div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          disabled={loading}
          className="w-full md:w-auto min-w-[160px] gap-2"
        >
          <Save className="w-5 h-5" />
          <span>{initialData && initialData.id ? 'Update Lead' : 'Create Lead'}</span>
        </Button>
      </div>
    </form>
  );
};

export default LeadForm;
