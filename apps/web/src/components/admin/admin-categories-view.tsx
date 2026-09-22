"use client";

import { useState } from "react";
import type { AdminCategory } from "@/lib/admin-types";
import {
  listAdminCategories,
  createAdminCategory,
  updateAdminCategory,
} from "@/lib/admin-client";

interface AdminCategoriesViewProps {
  initialCategories: AdminCategory[];
  labels: {
    title: string;
    addCategory: string;
    slug: string;
    nameID: string;
    nameEN: string;
    nameMS: string;
    sortOrder: string;
    active: string;
    inactive: string;
    edit: string;
    save: string;
    saved: string;
  };
}

export function AdminCategoriesView({
  initialCategories,
  labels,
}: AdminCategoriesViewProps) {
  const [categories, setCategories] =
    useState<AdminCategory[]>(initialCategories);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Add Modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addSlug, setAddSlug] = useState("");
  const [addNameID, setAddNameID] = useState("");
  const [addNameEN, setAddNameEN] = useState("");
  const [addNameMS, setAddNameMS] = useState("");
  const [addSortOrder, setAddSortOrder] = useState(0);
  const [addIsActive, setAddIsActive] = useState(true);
  const [addSubmitting, setAddSubmitting] = useState(false);

  // Edit Modal state
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(
    null,
  );
  const [editNameID, setEditNameID] = useState("");
  const [editNameEN, setEditNameEN] = useState("");
  const [editNameMS, setEditNameMS] = useState("");
  const [editSortOrder, setEditSortOrder] = useState(0);
  const [editIsActive, setEditIsActive] = useState(true);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const list = await listAdminCategories();
      setCategories(list);
    } catch {
      setMessage({ type: "error", text: "Failed to reload categories." });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setAddSlug("");
    setAddNameID("");
    setAddNameEN("");
    setAddNameMS("");
    setAddSortOrder(categories.length * 10);
    setAddIsActive(true);
    setIsAddOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddSubmitting(true);
    setMessage(null);
    try {
      await createAdminCategory({
        slug: addSlug.trim().toLowerCase(),
        name_id: addNameID.trim(),
        name_en: addNameEN.trim(),
        name_ms: addNameMS.trim(),
        sort_order: Number(addSortOrder),
        is_active: addIsActive,
      });
      setMessage({ type: "success", text: labels.saved });
      setIsAddOpen(false);
      fetchCategories();
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to create category.",
      });
    } finally {
      setAddSubmitting(false);
    }
  };

  const handleOpenEdit = (c: AdminCategory) => {
    setEditingCategory(c);
    setEditNameID(c.name_id);
    setEditNameEN(c.name_en);
    setEditNameMS(c.name_ms);
    setEditSortOrder(c.sort_order);
    setEditIsActive(c.is_active);
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    setEditSubmitting(true);
    setMessage(null);
    try {
      await updateAdminCategory(editingCategory.id, {
        name_id: editNameID.trim(),
        name_en: editNameEN.trim(),
        name_ms: editNameMS.trim(),
        sort_order: Number(editSortOrder),
        is_active: editIsActive,
      });
      setMessage({ type: "success", text: labels.saved });
      setEditingCategory(null);
      fetchCategories();
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update category.",
      });
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <div className="admin-categories">
      {message && (
        <div
          className={`admin-alert admin-alert--${message.type === "success" ? "success" : "error"}`}
        >
          {message.text}
        </div>
      )}

      <div className="admin-toolbar">
        <h2 className="admin-section-title">{labels.title}</h2>
        <button
          onClick={handleOpenAdd}
          className="admin-btn admin-btn--primary"
        >
          {labels.addCategory}
        </button>
      </div>

      {loading ? (
        <div className="admin-loading">Loading categories…</div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{labels.slug}</th>
                <th>{labels.nameID}</th>
                <th>{labels.nameEN}</th>
                <th>{labels.nameMS}</th>
                <th>{labels.sortOrder}</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id}>
                  <td>
                    <code>{cat.slug}</code>
                  </td>
                  <td>{cat.name_id}</td>
                  <td>{cat.name_en}</td>
                  <td>{cat.name_ms}</td>
                  <td>{cat.sort_order}</td>
                  <td>
                    <span
                      className={`admin-badge ${cat.is_active ? "admin-badge--success" : "admin-badge--muted"}`}
                    >
                      {cat.is_active ? labels.active : labels.inactive}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => handleOpenEdit(cat)}
                      className="admin-btn admin-btn--xs admin-btn--secondary"
                    >
                      {labels.edit}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      {isAddOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <h3>{labels.addCategory}</h3>
            <form onSubmit={handleCreateSubmit} className="admin-form">
              <div className="admin-form-group">
                <label>{labels.slug}:</label>
                <input
                  type="text"
                  value={addSlug}
                  onChange={(e) => setAddSlug(e.target.value)}
                  placeholder="e.g. tech-gadgets"
                  className="admin-input"
                  required
                />
              </div>
              <div className="admin-form-group">
                <label>{labels.nameID}:</label>
                <input
                  type="text"
                  value={addNameID}
                  onChange={(e) => setAddNameID(e.target.value)}
                  placeholder="Nama Bahasa Indonesia"
                  className="admin-input"
                  required
                />
              </div>
              <div className="admin-form-group">
                <label>{labels.nameEN}:</label>
                <input
                  type="text"
                  value={addNameEN}
                  onChange={(e) => setAddNameEN(e.target.value)}
                  placeholder="English Name"
                  className="admin-input"
                  required
                />
              </div>
              <div className="admin-form-group">
                <label>{labels.nameMS}:</label>
                <input
                  type="text"
                  value={addNameMS}
                  onChange={(e) => setAddNameMS(e.target.value)}
                  placeholder="Nama Bahasa Melayu"
                  className="admin-input"
                  required
                />
              </div>
              <div className="admin-form-group">
                <label>{labels.sortOrder}:</label>
                <input
                  type="number"
                  value={addSortOrder}
                  onChange={(e) => setAddSortOrder(Number(e.target.value))}
                  className="admin-input"
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-checkbox-label">
                  <input
                    type="checkbox"
                    checked={addIsActive}
                    onChange={(e) => setAddIsActive(e.target.checked)}
                  />
                  <span>Active in marketplace</span>
                </label>
              </div>

              <div className="admin-modal-actions">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  disabled={addSubmitting}
                  className="admin-btn admin-btn--secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addSubmitting}
                  className="admin-btn admin-btn--primary"
                >
                  {addSubmitting ? "Saving…" : labels.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingCategory && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <h3>
              {labels.edit}: <code>{editingCategory.slug}</code>
            </h3>
            <form onSubmit={handleUpdateSubmit} className="admin-form">
              <div className="admin-form-group">
                <label>{labels.nameID}:</label>
                <input
                  type="text"
                  value={editNameID}
                  onChange={(e) => setEditNameID(e.target.value)}
                  className="admin-input"
                  required
                />
              </div>
              <div className="admin-form-group">
                <label>{labels.nameEN}:</label>
                <input
                  type="text"
                  value={editNameEN}
                  onChange={(e) => setEditNameEN(e.target.value)}
                  className="admin-input"
                  required
                />
              </div>
              <div className="admin-form-group">
                <label>{labels.nameMS}:</label>
                <input
                  type="text"
                  value={editNameMS}
                  onChange={(e) => setEditNameMS(e.target.value)}
                  className="admin-input"
                  required
                />
              </div>
              <div className="admin-form-group">
                <label>{labels.sortOrder}:</label>
                <input
                  type="number"
                  value={editSortOrder}
                  onChange={(e) => setEditSortOrder(Number(e.target.value))}
                  className="admin-input"
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-checkbox-label">
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                  />
                  <span>Active in marketplace</span>
                </label>
              </div>

              <div className="admin-modal-actions">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  disabled={editSubmitting}
                  className="admin-btn admin-btn--secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="admin-btn admin-btn--primary"
                >
                  {editSubmitting ? "Saving…" : labels.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
