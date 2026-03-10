"use client";

/**
 * 📂 Store Category Manager
 * Simplified CRUD with inline Product Attributes (templateFields) editor
 */

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderOpen,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Store,
  ChevronDown,
  ChevronUp,
  Package,
  Layers,
  Upload,
  FileJson,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Types ───────────────────────────────────────────

interface ProductAttribute {
  key: string;
  label: string;
  labelAr: string;
  type: "text" | "number" | "select" | "multiselect" | "date" | "textarea" | "boolean";
  options?: string[];
  required: boolean;
  placeholder?: string;
}

interface VariantAttribute {
  key: string;
  label: string;
  labelAr: string;
  options: string[];
}

interface TemplateFields {
  hasVariants: boolean;
  variantAttributes?: VariantAttribute[];
  productAttributes?: ProductAttribute[];
}

interface StoreCategory {
  id: string;
  name: string;
  nameAr: string;
  slug: string;
  description?: string;
  descriptionAr?: string;
  icon?: string;
  color: string;
  order: number;
  isActive: boolean;
  templateFields?: TemplateFields;
  createdAt: string;
  updatedAt: string;
  _count: { stores: number };
}

interface CategoryFormData {
  name: string;
  nameAr: string;
  slug: string;
  description: string;
  descriptionAr: string;
  icon: string;
  color: string;
  order: number;
  isActive: boolean;
  templateFields: TemplateFields;
}

const defaultTemplate: TemplateFields = {
  hasVariants: false,
  variantAttributes: [],
  productAttributes: [],
};

const defaultForm: CategoryFormData = {
  name: "",
  nameAr: "",
  slug: "",
  description: "",
  descriptionAr: "",
  icon: "",
  color: "#6366f1",
  order: 0,
  isActive: true,
  templateFields: { ...defaultTemplate },
};

const ATTRIBUTE_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "select", label: "Select (single)" },
  { value: "multiselect", label: "Multi-select" },
  { value: "date", label: "Date" },
  { value: "textarea", label: "Long text" },
  { value: "boolean", label: "Yes / No" },
] as const;

// ─── Props ───────────────────────────────────────────

interface StoreCategoryManagerProps {
  categories: StoreCategory[];
  onCreateCategory: (data: CategoryFormData) => Promise<void>;
  onUpdateCategory: (id: string, data: Partial<CategoryFormData> & { isActive?: boolean }) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onImportCategories?: (categories: CategoryFormData[]) => Promise<void>;
}

// ─── Slug Generator ──────────────────────────────────

function generateSlug(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── Product Attribute Row ───────────────────────────

function AttributeRow({
  attr,
  index,
  onChange,
  onRemove,
}: {
  attr: ProductAttribute;
  index: number;
  onChange: (index: number, attr: ProductAttribute) => void;
  onRemove: (index: number) => void;
}) {
  const needsOptions = attr.type === "select" || attr.type === "multiselect";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-xl bg-card border border-border/40 p-3 space-y-2.5"
    >
      {/* Row 1: key + type + required + delete */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          value={attr.key}
          onChange={(e) => onChange(index, { ...attr, key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })}
          placeholder="key"
          className="h-7 w-24 px-2 rounded-md bg-muted/30 border border-border/40 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
        <input
          value={attr.label}
          onChange={(e) => onChange(index, { ...attr, label: e.target.value })}
          placeholder="Label (EN)"
          className="h-7 flex-1 min-w-[80px] px-2 rounded-md bg-muted/30 border border-border/40 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
        <input
          value={attr.labelAr}
          onChange={(e) => onChange(index, { ...attr, labelAr: e.target.value })}
          placeholder="التسمية"
          dir="rtl"
          className="h-7 flex-1 min-w-[80px] px-2 rounded-md bg-muted/30 border border-border/40 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
        <Select
          value={attr.type}
          onValueChange={(value) => onChange(index, { ...attr, type: value as ProductAttribute["type"] })}
        >
          <SelectTrigger size="sm" className="h-7 w-[130px] text-xs bg-muted/30 border-border/40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ATTRIBUTE_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value} className="text-xs">
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={attr.required}
            onChange={(e) => onChange(index, { ...attr, required: e.target.checked })}
            className="rounded accent-primary"
          />
          Required
        </label>
        <button
          onClick={() => onRemove(index)}
          className="p-1 rounded-md text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Row 2: Options (if select/multiselect) */}
      {needsOptions && (
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">
            Options (comma-separated)
          </label>
          <input
            value={(attr.options || []).join(", ")}
            onChange={(e) =>
              onChange(index, {
                ...attr,
                options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              })
            }
            placeholder="Option 1, Option 2, Option 3"
            className="w-full h-7 px-2 rounded-md bg-muted/30 border border-border/40 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
      )}
    </motion.div>
  );
}

// ─── Variant Attribute Row ───────────────────────────

function VariantRow({
  attr,
  index,
  onChange,
  onRemove,
}: {
  attr: VariantAttribute;
  index: number;
  onChange: (index: number, attr: VariantAttribute) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-xl bg-card border border-border/40 p-3 space-y-2.5"
    >
      <div className="flex items-center gap-2 flex-wrap">
        <input
          value={attr.key}
          onChange={(e) => onChange(index, { ...attr, key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })}
          placeholder="key"
          className="h-7 w-24 px-2 rounded-md bg-muted/30 border border-border/40 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
        <input
          value={attr.label}
          onChange={(e) => onChange(index, { ...attr, label: e.target.value })}
          placeholder="Label (EN)"
          className="h-7 flex-1 min-w-[80px] px-2 rounded-md bg-muted/30 border border-border/40 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
        <input
          value={attr.labelAr}
          onChange={(e) => onChange(index, { ...attr, labelAr: e.target.value })}
          placeholder="التسمية"
          dir="rtl"
          className="h-7 flex-1 min-w-[80px] px-2 rounded-md bg-muted/30 border border-border/40 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
        <button
          onClick={() => onRemove(index)}
          className="p-1 rounded-md text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="space-y-1">
        <label className="text-[10px] text-muted-foreground">
          Options (comma-separated)
        </label>
        <input
          value={(attr.options || []).join(", ")}
          onChange={(e) =>
            onChange(index, {
              ...attr,
              options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
            })
          }
          placeholder="S, M, L, XL"
          className="w-full h-7 px-2 rounded-md bg-muted/30 border border-border/40 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
      </div>
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────

export function StoreCategoryManager({
  categories,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onImportCategories,
}: StoreCategoryManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryFormData>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!form.nameAr) return;
    const slug = form.slug || generateSlug(form.name || form.nameAr);
    const finalForm = { ...form, slug };
    setSaving(true);
    try {
      if (editingId) {
        await onUpdateCategory(editingId, finalForm);
      } else {
        await onCreateCategory(finalForm);
      }
      setForm(defaultForm);
      setShowForm(false);
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (cat: StoreCategory) => {
    const tf = (cat.templateFields as TemplateFields) || defaultTemplate;
    setForm({
      name: cat.name,
      nameAr: cat.nameAr,
      slug: cat.slug,
      description: cat.description || "",
      descriptionAr: cat.descriptionAr || "",
      icon: cat.icon || "",
      color: cat.color,
      order: cat.order,
      isActive: cat.isActive ?? true,
      templateFields: {
        hasVariants: tf.hasVariants ?? false,
        variantAttributes: tf.variantAttributes ?? [],
        productAttributes: tf.productAttributes ?? [],
      },
    });
    setEditingId(cat.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDeleteCategory(id);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCancel = () => {
    setForm(defaultForm);
    setShowForm(false);
    setEditingId(null);
  };

  // ─── Template field helpers ──────────────────────

  const updateProductAttr = (index: number, attr: ProductAttribute) => {
    setForm((f) => {
      const attrs = [...(f.templateFields.productAttributes || [])];
      attrs[index] = attr;
      return { ...f, templateFields: { ...f.templateFields, productAttributes: attrs } };
    });
  };

  const removeProductAttr = (index: number) => {
    setForm((f) => {
      const attrs = [...(f.templateFields.productAttributes || [])];
      attrs.splice(index, 1);
      return { ...f, templateFields: { ...f.templateFields, productAttributes: attrs } };
    });
  };

  const addProductAttr = () => {
    setForm((f) => ({
      ...f,
      templateFields: {
        ...f.templateFields,
        productAttributes: [
          ...(f.templateFields.productAttributes || []),
          { key: "", label: "", labelAr: "", type: "text" as const, required: false },
        ],
      },
    }));
  };

  const updateVariantAttr = (index: number, attr: VariantAttribute) => {
    setForm((f) => {
      const attrs = [...(f.templateFields.variantAttributes || [])];
      attrs[index] = attr;
      return { ...f, templateFields: { ...f.templateFields, variantAttributes: attrs } };
    });
  };

  const removeVariantAttr = (index: number) => {
    setForm((f) => {
      const attrs = [...(f.templateFields.variantAttributes || [])];
      attrs.splice(index, 1);
      return { ...f, templateFields: { ...f.templateFields, variantAttributes: attrs } };
    });
  };

  const addVariantAttr = () => {
    setForm((f) => ({
      ...f,
      templateFields: {
        ...f.templateFields,
        variantAttributes: [
          ...(f.templateFields.variantAttributes || []),
          { key: "", label: "", labelAr: "", options: [] },
        ],
      },
    }));
  };

  // ─── JSON Import Handler ─────────────────────────

  const handleJsonImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      // Support both array and single object
      const items: any[] = Array.isArray(parsed) ? parsed : [parsed];

      if (items.length === 0) {
        throw new Error("No categories found in file");
      }

      // Map to CategoryFormData format
      const mapped: CategoryFormData[] = items.map((item) => ({
        name: item.name || "",
        nameAr: item.nameAr || item.name || "",
        slug: item.slug || generateSlug(item.name || item.nameAr || ""),
        description: item.description || "",
        descriptionAr: item.descriptionAr || "",
        icon: item.icon || "",
        color: item.color || "#6366f1",
        order: item.order ?? 0,
        isActive: item.isActive ?? true,
        templateFields: item.templateFields || { ...defaultTemplate },
      }));

      // Validate required fields
      const invalid = mapped.filter((m) => !m.nameAr && !m.name);
      if (invalid.length > 0) {
        throw new Error(`${invalid.length} categories missing both name and nameAr`);
      }

      setImporting(true);

      if (onImportCategories) {
        await onImportCategories(mapped);
      } else {
        // Fallback: create one by one
        for (const cat of mapped) {
          await onCreateCategory(cat);
        }
      }
    } catch (err: any) {
      alert(err?.message || "Failed to parse JSON file");
    } finally {
      setImporting(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ─── Render ──────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Hidden file input for JSON import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleJsonImport}
        className="hidden"
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-emerald-500" />
          <h3 className="text-sm font-semibold text-foreground">Store Categories</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground font-medium">
            {categories.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium bg-muted/40 hover:bg-muted/60 text-muted-foreground transition-all disabled:opacity-50"
          >
            {importing ? (
              <span className="animate-pulse">Importing...</span>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" />
                Import JSON
              </>
            )}
          </button>
          <button
            onClick={() => {
              setForm(defaultForm);
              setEditingId(null);
              setShowForm(true);
            }}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Category
          </button>
        </div>
      </div>

      {/* ─── Add/Edit Form ────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl bg-muted/20 border border-primary/20 p-4 space-y-4">
              <h4 className="text-xs font-semibold text-foreground">
                {editingId ? "Edit Category" : "New Category"}
              </h4>

              {/* ── Basic Info ───────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Category Name (AR — primary) */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Category Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.nameAr}
                    onChange={(e) => {
                      const nameAr = e.target.value;
                      setForm((f) => ({
                        ...f,
                        nameAr,
                        name: f.name || "",
                      }));
                    }}
                    className="w-full h-9 px-3 rounded-lg bg-card border border-border/50 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="مثال: الإلكترونيات"
                    dir="rtl"
                  />
                </div>

                {/* English Name (optional, for slug) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    English Name <span className="text-muted-foreground/50">(optional, for URL)</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setForm((f) => ({
                        ...f,
                        name,
                        slug: editingId ? f.slug : generateSlug(name),
                      }));
                    }}
                    className="w-full h-9 px-3 rounded-lg bg-card border border-border/50 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="e.g. Electronics"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Description <span className="text-muted-foreground/50">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={form.descriptionAr}
                    onChange={(e) => setForm((f) => ({ ...f, descriptionAr: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg bg-card border border-border/50 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="وصف مختصر للقسم"
                    dir="rtl"
                  />
                </div>

                {/* Icon */}
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Icon <span className="text-muted-foreground/50">(emoji or text)</span>
                  </label>
                  <input
                    type="text"
                    value={form.icon}
                    onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg bg-card border border-border/50 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="📱 or Smartphone"
                  />
                </div>

                {/* Color */}
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.color}
                      onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                      className="h-9 w-12 rounded-lg border border-border/50 cursor-pointer bg-card p-0.5"
                    />
                    <input
                      type="text"
                      value={form.color}
                      onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                      className="flex-1 h-9 px-3 rounded-lg bg-card border border-border/50 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="#6366f1"
                    />
                  </div>
                </div>

                {/* isActive Toggle */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </label>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                    className={cn(
                      "flex items-center gap-2 h-9 px-3 rounded-lg border text-sm transition-colors w-full",
                      form.isActive
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
                        : "bg-muted/30 border-border/50 text-muted-foreground",
                    )}
                  >
                    {form.isActive ? (
                      <ToggleRight className="h-4 w-4" />
                    ) : (
                      <ToggleLeft className="h-4 w-4" />
                    )}
                    {form.isActive ? "Active" : "Disabled"}
                  </button>
                </div>
              </div>

              {/* ── Product Attributes Section ──────── */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 border-t border-border/30 pt-4">
                  <Package className="h-4 w-4 text-blue-500" />
                  <h5 className="text-xs font-semibold text-foreground">Product Attributes for this Category</h5>
                </div>
                <p className="text-[11px] text-muted-foreground -mt-1">
                  Define custom fields that products in this category must fill in (e.g. Brand, Warranty, Material).
                </p>

                <AnimatePresence mode="popLayout">
                  {(form.templateFields.productAttributes || []).map((attr, i) => (
                    <AttributeRow
                      key={`pa-${i}`}
                      attr={attr}
                      index={i}
                      onChange={updateProductAttr}
                      onRemove={removeProductAttr}
                    />
                  ))}
                </AnimatePresence>

                <button
                  type="button"
                  onClick={addProductAttr}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-blue-600 bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Attribute
                </button>
              </div>

              {/* ── Variant Attributes Section ─────── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-t border-border/30 pt-4">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-purple-500" />
                    <h5 className="text-xs font-semibold text-foreground">Variant Options</h5>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.templateFields.hasVariants}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          templateFields: { ...f.templateFields, hasVariants: e.target.checked },
                        }))
                      }
                      className="rounded accent-primary"
                    />
                    Enable variants
                  </label>
                </div>

                {form.templateFields.hasVariants && (
                  <>
                    <p className="text-[11px] text-muted-foreground -mt-1">
                      Variant axes let sellers create product variations (e.g. Size: S/M/L, Color: Red/Blue).
                    </p>

                    <AnimatePresence mode="popLayout">
                      {(form.templateFields.variantAttributes || []).map((attr, i) => (
                        <VariantRow
                          key={`va-${i}`}
                          attr={attr}
                          index={i}
                          onChange={updateVariantAttr}
                          onRemove={removeVariantAttr}
                        />
                      ))}
                    </AnimatePresence>

                    <button
                      type="button"
                      onClick={addVariantAttr}
                      className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-purple-600 bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Variant Axis
                    </button>
                  </>
                )}
              </div>

              {/* ── Form Actions ─────────────────────── */}
              <div className="flex items-center justify-end gap-2 border-t border-border/30 pt-3">
                <button
                  onClick={handleCancel}
                  className="h-8 px-3 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving || !form.nameAr}
                  className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {saving ? (
                    <span className="animate-pulse">Saving...</span>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      {editingId ? "Update" : "Create"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Categories List ──────────────────────── */}
      <div className="rounded-2xl bg-muted/20 border border-border/30 overflow-hidden">
        {categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FolderOpen className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No categories yet</p>
            <p className="text-xs mt-1">Create your first store category</p>
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {categories.map((cat, index) => {
              const tf = (cat.templateFields as TemplateFields) || null;
              const attrCount = (tf?.productAttributes?.length || 0) + (tf?.variantAttributes?.length || 0);
              const isExpanded = expandedId === cat.id;

              return (
                <div key={cat.id}>
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors group"
                  >
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{cat.nameAr}</p>
                        {cat.name && (
                          <span className="text-[11px] text-muted-foreground">({cat.name})</span>
                        )}
                        {!cat.isActive && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/10 text-amber-600">
                            DISABLED
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          {cat._count.stores} store{cat._count.stores !== 1 ? "s" : ""}
                        </span>
                        {attrCount > 0 && (
                          <>
                            <span className="text-[10px] text-muted-foreground/50">·</span>
                            <span className="text-[10px] text-blue-500 font-medium">
                              {attrCount} attribute{attrCount !== 1 ? "s" : ""}
                            </span>
                          </>
                        )}
                        {tf?.hasVariants && (
                          <>
                            <span className="text-[10px] text-muted-foreground/50">·</span>
                            <span className="text-[10px] text-purple-500 font-medium">
                              Variants
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {attrCount > 0 && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : cat.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                          title="View attributes"
                        >
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                      )}
                      <button
                        onClick={() =>
                          onUpdateCategory(cat.id, { isActive: !cat.isActive } as any)
                        }
                        className={cn(
                          "p-1.5 rounded-lg text-xs transition-colors",
                          cat.isActive
                            ? "text-amber-500 hover:bg-amber-500/10"
                            : "text-emerald-500 hover:bg-emerald-500/10",
                        )}
                        title={cat.isActive ? "Disable" : "Enable"}
                      >
                        {cat.isActive ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => handleEdit(cat)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id)}
                        disabled={deletingId === cat.id || cat._count.stores > 0}
                        className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title={cat._count.stores > 0 ? "Cannot delete: stores exist" : "Delete"}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </motion.div>

                  {/* ── Expanded Attributes Preview ──── */}
                  <AnimatePresence>
                    {isExpanded && tf && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-3 space-y-2">
                          {(tf.productAttributes || []).length > 0 && (
                            <div className="rounded-lg bg-blue-500/5 border border-blue-500/10 p-2.5 space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <Package className="h-3 w-3 text-blue-500" />
                                <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">
                                  Product Attributes
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {(tf.productAttributes || []).map((a, i) => (
                                  <span
                                    key={i}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-[10px] text-blue-700 dark:text-blue-300"
                                  >
                                    {a.labelAr || a.label}
                                    <span className="text-blue-400 text-[9px]">({a.type})</span>
                                    {a.required && <span className="text-red-400">*</span>}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {tf.hasVariants && (tf.variantAttributes || []).length > 0 && (
                            <div className="rounded-lg bg-purple-500/5 border border-purple-500/10 p-2.5 space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <Layers className="h-3 w-3 text-purple-500" />
                                <span className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider">
                                  Variant Axes
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {(tf.variantAttributes || []).map((a, i) => (
                                  <span
                                    key={i}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 text-[10px] text-purple-700 dark:text-purple-300"
                                  >
                                    {a.labelAr || a.label}
                                    {a.options?.length > 0 && (
                                      <span className="text-purple-400 text-[9px]">
                                        ({a.options.length} options)
                                      </span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────

export function StoreCategoryManagerSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-muted/60 animate-pulse" />
          <div className="h-4 w-28 rounded bg-muted/60 animate-pulse" />
        </div>
        <div className="h-8 w-28 rounded-xl bg-muted/60 animate-pulse" />
      </div>
      <div className="rounded-2xl bg-muted/30 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border/10">
            <div className="h-9 w-9 rounded-xl bg-muted/60 animate-pulse" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-32 rounded bg-muted/60 animate-pulse" />
              <div className="h-2.5 w-20 rounded bg-muted/60 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
